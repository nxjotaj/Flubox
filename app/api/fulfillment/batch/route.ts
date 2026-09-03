import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({
  orderIds: z.array(z.uuid()).min(1).max(100),
  action: z.enum(['accept', 'ready']),
});
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await requireAccountPermission(user, 'fulfillment.manage');
  if (account.organization.type !== 'supplier')
    return Response.json(
      { error: 'Acesso exclusivo do fornecedor.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Selecione pedidos e uma ação válida.', requestId },
      { status: 422 },
    );
  const expected =
    parsed.data.action === 'accept' ? 'ready_for_supplier' : 'preparing';
  const target =
    parsed.data.action === 'accept' ? 'preparing' : 'ready_to_ship';
  const now = new Date().toISOString();
  let updated = 0;
  for (const orderId of parsed.data.orderIds) {
    const order = await getD1()
      .prepare(
        `SELECT o.id,fa.member_id assignedMemberId FROM orders o LEFT JOIN fulfillment_assignments fa ON fa.order_id=o.id WHERE o.id=? AND o.supplier_organization_id=? AND o.status=?`,
      )
      .bind(orderId, account.organization.id, expected)
      .first<{ id: string; assignedMemberId: string | null }>();
    if (
      !order ||
      (account.role.startsWith('supplier_operator_') &&
        order.assignedMemberId !== account.memberId)
    )
      continue;
    await getD1().batch([
      getD1()
        .prepare(
          `UPDATE orders SET status=?,updated_at=? WHERE id=? AND status=?`,
        )
        .bind(target, now, orderId, expected),
      getD1()
        .prepare(`UPDATE shipments SET status=?,updated_at=? WHERE order_id=?`)
        .bind(target, now, orderId),
      getD1()
        .prepare(
          `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          orderId,
          `logistics.${parsed.data.action}_batch`,
          expected,
          target,
          account.user.id,
          JSON.stringify({ requestId }),
          now,
        ),
    ]);
    updated++;
  }
  return Response.json({
    updated,
    skipped: parsed.data.orderIds.length - updated,
    requestId,
  });
}
