import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { ORDER_STATES } from '@/modules/orders/state-machine';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(ORDER_STATES),
  reason: z.string().trim().min(8).max(500),
  note: z.string().trim().max(1000).optional(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const admin = await requireAccountPermission(user, 'orders.manage');
  if (admin.organization.type !== 'platform')
    return Response.json(
      { error: 'Acesso negado.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      {
        error: 'Informe o novo status e uma justificativa detalhada.',
        requestId,
      },
      { status: 422 },
    );
  const { id } = await params;
  const order = await getD1()
    .prepare('SELECT status,notes FROM orders WHERE id=?')
    .bind(id)
    .first<{ status: string; notes: string | null }>();
  if (!order)
    return Response.json(
      { error: 'Pedido não encontrado.', requestId },
      { status: 404 },
    );
  if (order.status === parsed.data.status)
    return Response.json(
      { error: 'O pedido já está neste status.', requestId },
      { status: 409 },
    );
  const now = new Date().toISOString();
  const statements = [
    getD1()
      .prepare(
        'UPDATE orders SET status=?,notes=COALESCE(?,notes),updated_at=? WHERE id=?',
      )
      .bind(parsed.data.status, parsed.data.note ?? null, now, id),
    getD1()
      .prepare(
        `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,'admin.intervention',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        id,
        order.status,
        parsed.data.status,
        admin.user.id,
        JSON.stringify({ reason: parsed.data.reason, note: parsed.data.note }),
        now,
      ),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'order.admin_intervention','order',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        admin.organization.id,
        id,
        requestId,
        parsed.data.reason,
        JSON.stringify({
          from: order.status,
          to: parsed.data.status,
          note: parsed.data.note,
        }),
        now,
      ),
  ];
  if (['cancelled', 'payment_expired'].includes(parsed.data.status))
    statements.push(
      getD1()
        .prepare(
          `UPDATE inventory_reservations SET status='released',released_at=? WHERE order_id=? AND status='active'`,
        )
        .bind(now, id),
    );
  await getD1().batch(statements);
  return Response.json({ status: parsed.data.status, requestId });
}
