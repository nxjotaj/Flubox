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
  if (!account)
    return Response.json(
      { error: 'Conta necessária.', requestId },
      { status: 403 },
    );
  const { id } = await params;
  const now = new Date().toISOString();
  const result = await getD1()
    .prepare(
      `UPDATE support_cases SET status='mediation_requested',mediation_requested_at=?,updated_at=? WHERE id=? AND status='open' AND EXISTS (SELECT 1 FROM orders o WHERE o.id=support_cases.order_id AND (o.reseller_organization_id=? OR o.supplier_organization_id=?))`,
    )
    .bind(now, now, id, account.organization.id, account.organization.id)
    .run();
  if (!result.meta.changes)
    return Response.json(
      { error: 'Caso indisponível para mediação.', requestId },
      { status: 409 },
    );
  return Response.json({ status: 'mediation_requested', requestId });
}
