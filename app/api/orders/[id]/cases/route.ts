import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import {
  assertOrderTransition,
  type OrderState,
} from '@/modules/orders/state-machine';
import { z } from 'zod';
const schema = z.object({
  type: z.enum(['return', 'dispute']),
  reason: z.enum([
    'defect',
    'wrong_product',
    'missing_item',
    'damage',
    'material_difference',
    'withdrawal',
    'reseller_error',
    'logistics',
    'loss',
    'other',
  ]),
  description: z.string().trim().min(10).max(1500),
});
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
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Informe tipo, motivo e descrição detalhada.', requestId },
      { status: 422 },
    );
  const { id } = await params;
  const order = await getD1()
    .prepare(
      `SELECT id,status FROM orders WHERE id=? AND (reseller_organization_id=? OR supplier_organization_id=?)`,
    )
    .bind(id, account.organization.id, account.organization.id)
    .first<{ id: string; status: OrderState }>();
  if (!order)
    return Response.json(
      { error: 'Pedido não encontrado.', requestId },
      { status: 404 },
    );
  const target = parsed.data.type === 'return' ? 'returning' : 'disputed';
  try {
    assertOrderTransition(order.status, target);
  } catch {
    return Response.json(
      {
        error: 'O estado atual do pedido não permite esta solicitação.',
        requestId,
      },
      { status: 409 },
    );
  }
  const caseId = crypto.randomUUID();
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO support_cases (id,order_id,opened_by_organization_id,type,reason,description,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'open',?,?,?)`,
      )
      .bind(
        caseId,
        id,
        account.organization.id,
        parsed.data.type,
        parsed.data.reason,
        parsed.data.description,
        account.user.id,
        now,
        now,
      ),
    getD1()
      .prepare(`UPDATE orders SET status=?,updated_at=? WHERE id=?`)
      .bind(target, now, id),
    getD1()
      .prepare(
        `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,'post_sale.opened',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        id,
        order.status,
        target,
        account.user.id,
        JSON.stringify({ caseId, reason: parsed.data.reason }),
        now,
      ),
  ]);
  return Response.json(
    { id: caseId, status: 'open', requestId },
    { status: 201 },
  );
}
