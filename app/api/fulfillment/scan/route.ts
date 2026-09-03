import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({
  barcode: z.string().trim().min(3).max(180),
  carrier: z.string().trim().min(2).max(60).default('Etiqueta do revendedor'),
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
      { error: 'Código de barras inválido.', requestId },
      { status: 422 },
    );
  const order = await getD1()
    .prepare(
      `SELECT o.id,o.number,o.status,fa.member_id assignedMemberId FROM order_documents d JOIN orders o ON o.id=d.order_id LEFT JOIN fulfillment_assignments fa ON fa.order_id=o.id WHERE d.type='shipping_label' AND d.barcode_value=? AND o.supplier_organization_id=? LIMIT 1`,
    )
    .bind(parsed.data.barcode, account.organization.id)
    .first<{
      id: string;
      number: string;
      status: string;
      assignedMemberId: string | null;
    }>();
  if (!order)
    return Response.json(
      { error: 'Etiqueta não localizada para este fornecedor.', requestId },
      { status: 404 },
    );
  if (
    account.role.startsWith('supplier_operator_') &&
    order.assignedMemberId !== account.memberId
  )
    return Response.json(
      { error: 'Este pacote está atribuído a outro operador.', requestId },
      { status: 403 },
    );
  if (
    ['shipped', 'in_transit', 'delivered', 'completed'].includes(order.status)
  )
    return Response.json({
      order: order.number,
      status: order.status,
      idempotent: true,
      requestId,
    });
  if (order.status !== 'ready_to_ship')
    return Response.json(
      {
        error: `O pedido ${order.number} ainda não está pronto para envio.`,
        requestId,
      },
      { status: 409 },
    );
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE orders SET status='shipped',updated_at=? WHERE id=? AND status='ready_to_ship'`,
      )
      .bind(now, order.id),
    getD1()
      .prepare(
        `UPDATE shipments SET carrier=?,tracking_code=?,status='shipped',shipped_at=?,updated_at=? WHERE order_id=?`,
      )
      .bind(parsed.data.carrier, parsed.data.barcode, now, now, order.id),
    getD1()
      .prepare(
        `UPDATE fulfillment_assignments SET completed_at=? WHERE order_id=?`,
      )
      .bind(now, order.id),
    getD1()
      .prepare(
        `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,'logistics.barcode_shipped','ready_to_ship','shipped',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        order.id,
        account.user.id,
        JSON.stringify({ barcode: parsed.data.barcode }),
        now,
      ),
    getD1()
      .prepare(
        `INSERT INTO tracking_events (id,shipment_id,status,description,source,occurred_at,created_at) SELECT ?,id,'shipped','Envio confirmado por leitura de etiqueta','barcode',?,? FROM shipments WHERE order_id=?`,
      )
      .bind(crypto.randomUUID(), now, now, order.id),
  ]);
  return Response.json({ order: order.number, status: 'shipped', requestId });
}
