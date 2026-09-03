import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'reseller')
    return Response.json(
      { error: 'Acesso exclusivo para revendedores.', requestId },
      { status: 403 },
    );
  const { id } = await params;
  const supplier = await getD1()
    .prepare(
      `SELECT o.id FROM organizations o JOIN supplier_profiles p ON p.organization_id=o.id JOIN subscriptions s ON s.organization_id=o.id AND s.status IN ('active','grace_period') WHERE o.id=? AND o.type='supplier' AND o.status='active'`,
    )
    .bind(id)
    .first();
  if (!supplier)
    return Response.json(
      { error: 'Fornecedor indisponível.', requestId },
      { status: 404 },
    );
  const existing = await getD1()
    .prepare(
      'SELECT supplier_organization_id FROM supplier_followers WHERE reseller_organization_id=? AND supplier_organization_id=?',
    )
    .bind(account.organization.id, id)
    .first();
  const now = new Date().toISOString();
  if (existing) {
    await getD1()
      .prepare(
        'DELETE FROM supplier_followers WHERE reseller_organization_id=? AND supplier_organization_id=?',
      )
      .bind(account.organization.id, id)
      .run();
  } else {
    await getD1().batch([
      getD1()
        .prepare(
          'INSERT INTO supplier_followers (reseller_organization_id,supplier_organization_id,created_by,created_at) VALUES (?,?,?,?)',
        )
        .bind(account.organization.id, id, account.user.id, now),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,created_at) VALUES (?,?,?,'supplier.followed','supplier',?,?,?)`,
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
  }
  return Response.json({ following: !existing, requestId });
}
