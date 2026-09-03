import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account)
    return Response.json({ error: 'Conta não encontrada.' }, { status: 403 });
  await getD1()
    .prepare(
      'UPDATE notifications SET read_at=? WHERE organization_id=? AND read_at IS NULL',
    )
    .bind(new Date().toISOString(), account.organization.id)
    .run();
  return Response.json({ success: true });
}
