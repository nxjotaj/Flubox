import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { onboardingSchema } from '@/modules/onboarding/schema';
import { saveOnboarding } from '@/modules/onboarding/service';

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login para continuar.', requestId },
        { status: 401 },
      );
    const account = await requireAccountPermission(user, 'organization.manage');
    const parsed = onboardingSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error:
            parsed.error.issues[0]?.message ?? 'Revise os dados informados.',
          requestId,
        },
        { status: 422 },
      );
    await saveOnboarding(account, parsed.data, requestId);
    return Response.json({
      ok: true,
      next:
        parsed.data.type === 'supplier'
          ? '/onboarding/documentos'
          : '/dashboard',
      requestId,
    });
  } catch (error) {
    logError(error, { requestId, route: 'POST /api/onboarding/profile' });
    return Response.json(
      { error: 'Não foi possível salvar seus dados agora.', requestId },
      { status: 500 },
    );
  }
}
