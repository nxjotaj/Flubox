import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { logError, requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { addBusinessDays } from '@/modules/logistics/sla';
import { selectAvailableOperator } from '@/modules/fulfillment/assignment';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    if (process.env.NODE_ENV === 'production')
      return Response.json(
        { error: 'Confirmação manual indisponível em produção.', requestId },
        { status: 403 },
      );
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await getAccountContext(user);
    if (!account || account.organization.type !== 'reseller')
      return Response.json(
        { error: 'Acesso exclusivo para revendedores.', requestId },
        { status: 403 },
      );
    const { id } = await params;
    const order = await getD1()
      .prepare(
        `SELECT id,status,total_cents totalCents,commission_cents commissionCents,supplier_organization_id supplierId,reseller_organization_id resellerId FROM orders WHERE id=? AND reseller_organization_id=?`,
      )
      .bind(id, account.organization.id)
      .first<{
        id: string;
        status: string;
        totalCents: number;
        commissionCents: number;
        supplierId: string;
        resellerId: string;
      }>();
    if (!order)
      return Response.json(
        { error: 'Pedido não encontrado.', requestId },
        { status: 404 },
      );
    if (
      [
        'paid_awaiting_documents',
        'ready_for_supplier',
        'preparing',
        'ready_to_ship',
        'shipped',
        'in_transit',
        'delivered',
        'completed',
      ].includes(order.status)
    )
      return Response.json({
        status: order.status,
        idempotent: true,
        requestId,
      });
    if (order.status !== 'awaiting_payment')
      return Response.json(
        {
          error: 'Este pedido não pode receber confirmação de pagamento.',
          requestId,
        },
        { status: 409 },
      );

    const now = new Date().toISOString();
    const documentCoverage = await getD1()
      .prepare(
        `SELECT COALESCE(SUM(d.quantity_covered) FILTER (WHERE d.type='shipping_label'),0) covered,COUNT(*) FILTER (WHERE d.type IN ('nfe_danfe','content_declaration')) fiscal,(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=?) totalUnits FROM order_documents d WHERE d.order_id=?`,
      )
      .bind(id, id)
      .first<{ covered: number; fiscal: number; totalUnits: number }>();
    const documentsComplete =
      Number(documentCoverage?.covered ?? 0) >= Number(documentCoverage?.totalUnits ?? 0) &&
      Number(documentCoverage?.fiscal ?? 0) > 0;
    const nextStatus = documentsComplete ? 'ready_for_supplier' : 'paid_awaiting_documents';
    const items = await getD1()
      .prepare(
        `SELECT product_id productId,variant_id variantId,quantity FROM order_items WHERE order_id=?`,
      )
      .bind(id)
      .all<{ productId: string; variantId: string | null; quantity: number }>();
    const supplierNet = order.totalCents - order.commissionCents;
    const statements = [
      getD1()
        .prepare(
          `UPDATE orders SET status=?,updated_at=? WHERE id=? AND status='awaiting_payment'`,
        )
        .bind(nextStatus, now, id),
      getD1()
        .prepare(
          `UPDATE payment_intents SET status='paid',paid_at=?,updated_at=? WHERE order_id=? AND status='pending'`,
        )
        .bind(now, now, id),
      getD1()
        .prepare(
          `UPDATE inventory_reservations SET status='converted',released_at=? WHERE order_id=? AND status='active'`,
        )
        .bind(now, id),
      getD1()
        .prepare(
          `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,'payment.confirmed','awaiting_payment',?,?,?,?) ON CONFLICT DO NOTHING`,
        )
        .bind(
          `event:${id}:paid`,
          id,
          nextStatus,
          account.user.id,
          JSON.stringify({ development: true, documentsComplete }),
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO ledger_entries (id,order_id,organization_id,account,direction,amount_cents,currency,status,reference_type,reference_id,metadata,created_at) VALUES (?,?,?,'purchase','debit',?,'BRL','posted','order',?,?,?) ON CONFLICT DO NOTHING`,
        )
        .bind(
          `ledger:${id}:reseller`,
          id,
          order.resellerId,
          order.totalCents,
          id,
          JSON.stringify({ commissionCents: order.commissionCents }),
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO ledger_entries (id,order_id,organization_id,account,direction,amount_cents,currency,status,reference_type,reference_id,metadata,created_at) VALUES (?,?,?,'sales_receivable','credit',?,'BRL','posted','order',?,?,?) ON CONFLICT DO NOTHING`,
        )
        .bind(
          `ledger:${id}:supplier`,
          id,
          order.supplierId,
          supplierNet,
          id,
          JSON.stringify({
            grossCents: order.totalCents,
            commissionCents: order.commissionCents,
          }),
          now,
        ),
    ];
    if (documentsComplete) {
      const operator = await selectAvailableOperator(order.supplierId);
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO shipments (id,order_id,carrier,status,preparation_deadline,created_at,updated_at) VALUES (?,?,'pending','preparing',?,?,?) ON CONFLICT(order_id) DO UPDATE SET preparation_deadline=excluded.preparation_deadline,updated_at=excluded.updated_at`,
          )
          .bind(crypto.randomUUID(), id, addBusinessDays(now, 1), now, now),
      );
      if (operator)
        statements.push(
          getD1()
            .prepare(
              `INSERT INTO fulfillment_assignments (order_id,member_id,assigned_by,assigned_at) VALUES (?,?,?,?) ON CONFLICT(order_id) DO NOTHING`,
            )
            .bind(id, operator.memberId, account.user.id, now),
        );
      const supplierUser = await getD1()
        .prepare(
          `SELECT u.id FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? AND m.status='active' ORDER BY m.created_at LIMIT 1`,
        )
        .bind(order.supplierId)
        .first<{ id: string }>();
      if (supplierUser)
        statements.push(
          getD1()
            .prepare(
              `INSERT INTO notifications (id,user_id,organization_id,type,title,body,entity_type,entity_id,created_at) VALUES (?,?,?,'order.ready','Novo pedido liberado','Pagamento e documentos confirmados. O prazo de postagem é de 1 dia útil.','order',?,?)`,
            )
            .bind(crypto.randomUUID(), supplierUser.id, order.supplierId, id, now),
        );
    }
    for (const item of items.results)
    {
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO inventory_movements (id,product_id,organization_id,type,quantity,reference_type,reference_id,created_by,created_at) VALUES (?,?,?,'sale',?,'order',?,?,?) ON CONFLICT DO NOTHING`,
          )
          .bind(
            `inventory:${id}:${item.productId}:sale`,
            item.productId,
            order.supplierId,
            -item.quantity,
            id,
            account.user.id,
            now,
          ),
      );
      if(item.variantId) statements.push(getD1().prepare(`UPDATE product_variants SET stock=GREATEST(0,stock-?),updated_at=? WHERE id=?`).bind(item.quantity,now,item.variantId));
    }
    await getD1().batch(statements);
    return Response.json({
      status: nextStatus,
      next: `/pedidos/${id}`,
      requestId,
    });
  } catch (error) {
    logError(error, { requestId, route: 'POST order payment confirmation' });
    return Response.json(
      {
        error: 'Não foi possível confirmar o pagamento de teste.',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { detail: error.message }
          : {}),
        requestId,
      },
      { status: 500 },
    );
  }
}
