import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { addBusinessDays } from '@/modules/logistics/sla';
import {
  assertOrderTransition,
  type OrderState,
} from '@/modules/orders/state-machine';
import { z } from 'zod';
const schema = z
  .object({
    action: z.enum(['accept', 'ready', 'ship', 'deliver']),
    carrier: z.string().trim().min(2).max(60).optional(),
    trackingCode: z.string().trim().min(5).max(80).optional(),
  })
  .superRefine((value, context) => {
    if (value.action === 'ship' && (!value.carrier || !value.trackingCode))
      context.addIssue({
        code: 'custom',
        message: 'Transportadora e rastreio são obrigatórios.',
      });
  });
const targets = {
  accept: 'preparing',
  ready: 'ready_to_ship',
  ship: 'shipped',
  deliver: 'delivered',
} as const;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await getAccountContext(user);
    if (!account || account.organization.type !== 'supplier')
      return Response.json(
        { error: 'Acesso exclusivo do fornecedor.', requestId },
        { status: 403 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Ação inválida.',
          requestId,
        },
        { status: 422 },
      );
    const { id } = await params;
    const order = await getD1()
      .prepare(
        `SELECT o.id,o.status,o.reseller_organization_id resellerId,MAX(so.preparation_days) preparationDays FROM orders o JOIN order_items i ON i.order_id=o.id JOIN supplier_offers so ON so.product_id=i.product_id WHERE o.id=? AND o.supplier_organization_id=? GROUP BY o.id`,
      )
      .bind(id, account.organization.id)
      .first<{
        id: string;
        status: OrderState;
        resellerId: string;
        preparationDays: number;
      }>();
    if (!order)
      return Response.json(
        { error: 'Pedido não encontrado.', requestId },
        { status: 404 },
      );
    const target = targets[parsed.data.action];
    assertOrderTransition(order.status, target);
    const now = new Date().toISOString();
    const statements = [
      getD1()
        .prepare('UPDATE orders SET status=?,updated_at=? WHERE id=?')
        .bind(target, now, id),
      getD1()
        .prepare(
          'INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,?,?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          id,
          `logistics.${parsed.data.action}`,
          order.status,
          target,
          account.user.id,
          JSON.stringify({
            carrier: parsed.data.carrier,
            trackingCode: parsed.data.trackingCode,
          }),
          now,
        ),
    ];
    if (parsed.data.action === 'accept')
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO shipments (id,order_id,carrier,status,preparation_deadline,created_at,updated_at) VALUES (?,?,'pending','preparing',?,?,?) ON CONFLICT(order_id) DO UPDATE SET status='preparing',updated_at=excluded.updated_at`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            addBusinessDays(now, order.preparationDays),
            now,
            now,
          ),
      );
    if (parsed.data.action === 'ready')
      statements.push(
        getD1()
          .prepare(
            `UPDATE shipments SET status='ready_to_ship',updated_at=? WHERE order_id=?`,
          )
          .bind(now, id),
      );
    if (parsed.data.action === 'ship') {
      statements.push(
        getD1()
          .prepare(
            `UPDATE shipments SET carrier=?,tracking_code=?,status='shipped',shipped_at=?,updated_at=? WHERE order_id=?`,
          )
          .bind(parsed.data.carrier, parsed.data.trackingCode, now, now, id),
      );
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO tracking_events (id,shipment_id,status,description,source,occurred_at,created_at) SELECT ?,id,'shipped','Envio informado pelo fornecedor','manual',?,? FROM shipments WHERE order_id=?`,
          )
          .bind(crypto.randomUUID(), now, now, id),
      );
    }
    if (parsed.data.action === 'deliver') {
      statements.push(
        getD1()
          .prepare(
            `UPDATE shipments SET status='delivered',delivered_at=?,updated_at=? WHERE order_id=?`,
          )
          .bind(now, now, id),
      );
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO tracking_events (id,shipment_id,status,description,source,occurred_at,created_at) SELECT ?,id,'delivered','Entrega confirmada manualmente','manual',?,? FROM shipments WHERE order_id=?`,
          )
          .bind(crypto.randomUUID(), now, now, id),
      );
    }
    const recipient = await getD1()
      .prepare(
        `SELECT u.id FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? AND m.status='active' LIMIT 1`,
      )
      .bind(order.resellerId)
      .first<{ id: string }>();
    if (recipient)
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO notifications (id,user_id,organization_id,type,title,body,entity_type,entity_id,created_at) VALUES (?,?,?,'order_update','Pedido atualizado',?,'order',?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            recipient.id,
            order.resellerId,
            `O pedido avançou para ${target}.`,
            id,
            now,
          ),
      );
    await getD1().batch(statements);
    return Response.json({ status: target, requestId });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('INVALID_ORDER_TRANSITION')
    )
      return Response.json(
        { error: 'Transição não permitida para o estado atual.', requestId },
        { status: 409 },
      );
    logError(error, { requestId, route: 'POST order logistics' });
    return Response.json(
      { error: 'Não foi possível atualizar a logística.', requestId },
      { status: 500 },
    );
  }
}
