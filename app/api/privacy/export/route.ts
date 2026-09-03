import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  const account = await getAccountContext(user);
  const [profile, memberships, orders, cases] = await Promise.all([
    getD1()
      .prepare(
        `SELECT id,email,name,status,created_at createdAt FROM users WHERE id=?`,
      )
      .bind(account?.user.id)
      .first(),
    getD1()
      .prepare(
        `SELECT organization_id organizationId,status,created_at createdAt FROM organization_members WHERE user_id=?`,
      )
      .bind(account?.user.id)
      .all(),
    account
      ? getD1()
          .prepare(
            `SELECT id,number,status,channel,external_reference externalReference,created_at createdAt FROM orders WHERE reseller_organization_id=? OR supplier_organization_id=?`,
          )
          .bind(account.organization.id, account.organization.id)
          .all()
      : Promise.resolve({ results: [] }),
    account
      ? getD1()
          .prepare(
            `SELECT c.id,c.type,c.reason,c.status,c.created_at createdAt FROM support_cases c JOIN orders o ON o.id=c.order_id WHERE o.reseller_organization_id=? OR o.supplier_organization_id=?`,
          )
          .bind(account.organization.id, account.organization.id)
          .all()
      : Promise.resolve({ results: [] }),
  ]);
  return Response.json(
    {
      exportedAt: new Date().toISOString(),
      profile,
      memberships: memberships.results,
      orders: orders.results,
      cases: cases.results,
      notice:
        'Documentos e evidências binárias não são incluídos neste pacote JSON; podem ser solicitados ao suporte.',
    },
    {
      headers: {
        'content-disposition':
          'attachment; filename="flubox-dados-pessoais.json"',
        'cache-control': 'private, no-store',
      },
    },
  );
}
