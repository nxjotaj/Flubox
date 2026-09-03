import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { createOrganizationForUser } from '@/modules/identity/service';
import { logError, requestIdFrom } from '@/lib/request-context';
import { z } from 'zod';

const inputSchema = z.object({
  type: z.enum(['supplier', 'reseller']),
  displayName: z
    .string()
    .trim()
    .min(2, 'Informe um nome com pelo menos 2 caracteres.')
    .max(120),
});

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser)
      return Response.json(
        { error: 'Faça login para continuar.', requestId },
        { status: 401 },
      );

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
          requestId,
        },
        { status: 422 },
      );

    const account = await createOrganizationForUser({
      authUser,
      ...parsed.data,
      requestId,
    });
    return Response.json({ account, requestId }, { status: 201 });
  } catch (error) {
    logError(error, { requestId, route: 'POST /api/onboarding/organization' });
    return Response.json(
      {
        error: 'Não foi possível criar sua organização agora. Tente novamente.',
        requestId,
      },
      { status: 500 },
    );
  }
}
