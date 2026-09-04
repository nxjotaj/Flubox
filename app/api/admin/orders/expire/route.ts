import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const admin = await requireAccountPermission(user, 'settings.manage');
    const now = new Date().toISOString();
    const expired = await getD1()
      .prepare(
        `SELECT DISTINCT o.id FROM orders o JOIN inventory_reservations r ON r.order_id=o.id WHERE o.status='awaiting_payment' AND r.status='active' AND r.expires_at<=?`,
      )
      .bind(now)
      .all<{ id: string }>();
    for (const order of expired.results)
      await getD1().batch([
        getD1()
          .prepare(
            `UPDATE orders SET status='payment_expired',updated_at=? WHERE id=? AND status='awaiting_payment'`,
          )
          .bind(now, order.id),
        getD1()
          .prepare(
            `UPDATE inventory_reservations SET status='expired',released_at=? WHERE order_id=? AND status='active'`,
          )
          .bind(now, order.id),
        getD1()
          .prepare(
            `UPDATE payment_intents SET status='expired',updated_at=? WHERE order_id=? AND status!='paid'`,
          )
          .bind(now, order.id),
        getD1()
          .prepare(
            `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,created_at) VALUES (?,?,'payment.expired','awaiting_payment','payment_expired',?,?)`,
          )
          .bind(crypto.randomUUID(), order.id, admin.user.id, now),
        getD1()
          .prepare(
            `UPDATE sales_channel_listings SET status='paused',published_stock=0,last_error='Pagamento do custo expirado; revise a venda no marketplace.',updated_at=? WHERE id IN (SELECT l.id FROM sales_channel_listings l JOIN sales_channel_order_links ol ON ol.connection_id=l.connection_id JOIN order_items oi ON oi.order_id=ol.order_id AND oi.product_id=l.product_id AND oi.variant_id IS NOT DISTINCT FROM l.variant_id WHERE ol.order_id=?)`,
          )
          .bind(now, order.id),
        getD1()
          .prepare(
            `INSERT INTO notifications (id,user_id,organization_id,type,title,body,entity_type,entity_id,created_at) SELECT ?,c.created_by,c.organization_id,'marketplace.payment_expired','Pagamento do marketplace expirado','O estoque foi liberado e o anúncio pausado. Revise a venda diretamente no canal.','order',?,? FROM sales_channel_order_links ol JOIN sales_channel_connections c ON c.id=ol.connection_id WHERE ol.order_id=? ON CONFLICT DO NOTHING`,
          )
          .bind(crypto.randomUUID(), order.id, now, order.id),
      ]);
    await getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'orders.expired_checked','order','expired_reservations',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        admin.organization.id,
        requestId,
        JSON.stringify({ expired: expired.results.length }),
        now,
      )
      .run();
    return Response.json({ expired: expired.results.length, requestId });
  } catch (error) {
    logError(error, { requestId, route: 'expire orders' });
    return Response.json(
      { error: 'Não foi possível expirar pedidos.', requestId },
      { status: 500 },
    );
  }
}
