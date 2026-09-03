import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await requireAccountPermission(user, 'organization.manage');
  const { id } = await params;
  const member = await getD1()
    .prepare(
      `SELECT m.id,m.user_id userId,r.key role FROM organization_members m JOIN roles r ON r.id=m.role_id WHERE m.id=? AND m.organization_id=? AND m.status='active'`,
    )
    .bind(id, account.organization.id)
    .first<{ id: string; userId: string; role: string }>();
  if (!member)
    return Response.json(
      { error: 'Membro não encontrado.', requestId },
      { status: 404 },
    );
  if (member.userId === account.user.id)
    return Response.json(
      {
        error: 'Transfira a propriedade antes de remover seu próprio acesso.',
        requestId,
      },
      { status: 409 },
    );
  if (member.role.endsWith('_owner')) {
    const owners = await getD1()
      .prepare(
        `SELECT COUNT(*) total FROM organization_members m JOIN roles r ON r.id=m.role_id WHERE m.organization_id=? AND m.status='active' AND r.key LIKE '%_owner'`,
      )
      .bind(account.organization.id)
      .first<{ total: number }>();
    if ((owners?.total ?? 0) <= 1)
      return Response.json(
        {
          error: 'A organização precisa manter ao menos um proprietário.',
          requestId,
        },
        { status: 409 },
      );
  }
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE organization_members SET status='revoked' WHERE id=? AND organization_id=?`,
      )
      .bind(id, account.organization.id),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,created_at) VALUES (?,?,?,'member.revoked','organization_member',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        id,
        requestId,
        now,
      ),
  ]);
  return Response.json({ revoked: true, requestId });
}
