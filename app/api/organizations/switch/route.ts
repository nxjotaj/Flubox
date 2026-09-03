import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  syncAuthenticatedUser,
} from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({ organizationId: z.uuid() });
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const authUser = await getAuthenticatedUser();
  if (!authUser)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Organização inválida.', requestId },
      { status: 422 },
    );
  const userId = await syncAuthenticatedUser(authUser);
  const membership = await getD1()
    .prepare(
      `SELECT id FROM organization_members WHERE user_id=? AND organization_id=? AND status='active'`,
    )
    .bind(userId, parsed.data.organizationId)
    .first();
  if (!membership)
    return Response.json(
      { error: 'Acesso negado.', requestId },
      { status: 403 },
    );
  const response = Response.json({ switched: true, requestId });
  response.headers.append(
    'Set-Cookie',
    `${ACTIVE_ORGANIZATION_COOKIE}=${parsed.data.organizationId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
  );
  return response;
}
