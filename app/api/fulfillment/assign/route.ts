import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({ orderId: z.uuid(), memberId: z.string().min(1) });
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await requireAccountPermission(user, 'organization.manage');
  if (
    account.organization.type !== 'supplier' ||
    account.role !== 'supplier_owner'
  )
    return Response.json(
      { error: 'Somente o proprietário distribui pedidos.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Pedido ou operador inválido.', requestId },
      { status: 422 },
    );
  const [order, member] = await Promise.all([
    getD1()
      .prepare(
        `SELECT id FROM orders WHERE id=? AND supplier_organization_id=? AND status IN ('ready_for_supplier','preparing','ready_to_ship')`,
      )
      .bind(parsed.data.orderId, account.organization.id)
      .first(),
    getD1()
      .prepare(
        `SELECT m.id FROM organization_members m JOIN roles r ON r.id=m.role_id WHERE m.id=? AND m.organization_id=? AND m.status='active' AND r.key IN ('supplier_operator_1','supplier_operator_2')`,
      )
      .bind(parsed.data.memberId, account.organization.id)
      .first(),
  ]);
  if (!order || !member)
    return Response.json(
      { error: 'Pedido ou operador não está disponível.', requestId },
      { status: 404 },
    );
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO fulfillment_assignments (order_id,member_id,assigned_by,assigned_at,completed_at) VALUES (?,?,?,?,NULL) ON CONFLICT(order_id) DO UPDATE SET member_id=excluded.member_id,assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at,completed_at=NULL`,
      )
      .bind(parsed.data.orderId, parsed.data.memberId, account.user.id, now),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'fulfillment.assigned','order',?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        parsed.data.orderId,
        requestId,
        JSON.stringify({ memberId: parsed.data.memberId }),
        now,
      ),
  ]);
  return Response.json({ assigned: true, requestId });
}
