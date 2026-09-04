import 'server-only';
import { getD1 } from '@/db';
import { getPaymentProvider } from '@/modules/payments/provider';
import { getMarketplaceAdapter } from './adapters';
import { hashIntegrationValue } from './crypto';
import type { MarketplaceProvider } from './types';

type Connection = { id: string; organizationId: string; createdBy: string };

function scalar(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
}

export async function ingestMarketplaceWebhook(input: {
  provider: MarketplaceProvider;
  rawBody: string;
  signature: string | null;
}) {
  const adapter = getMarketplaceAdapter(input.provider);
  const signatureValid = adapter.verifyWebhook(input.rawBody, input.signature);
  const event = adapter.normalizeWebhook(input.rawBody);
  const connection = event.connectionExternalId
    ? await getD1()
        .prepare(
          `SELECT id,organization_id organizationId,created_by createdBy FROM sales_channel_connections WHERE provider=? AND external_account_id=?`,
        )
        .bind(input.provider, event.connectionExternalId)
        .first<Connection>()
    : null;
  if (!connection) throw new Error('CONNECTION_NOT_FOUND');
  const existing = await getD1()
    .prepare(
      'SELECT id,status FROM sales_channel_events WHERE provider=? AND external_event_id=?',
    )
    .bind(input.provider, event.externalEventId)
    .first<{ id: string; status: string }>();
  if (existing)
    return { duplicate: true, accepted: existing.status !== 'rejected' };
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getD1()
    .prepare(
      `INSERT INTO sales_channel_events (id,provider,connection_id,external_event_id,type,signature_valid,status,payload_hash,payload_json,received_at) VALUES (?,?,?,?,?,?,?, ?,?,?)`,
    )
    .bind(
      id,
      input.provider,
      connection.id,
      event.externalEventId,
      event.type,
      signatureValid,
      signatureValid ? 'received' : 'rejected',
      hashIntegrationValue(input.rawBody),
      input.rawBody,
      now,
    )
    .run();
  if (!signatureValid) return { duplicate: false, accepted: false };
  try {
    if (event.type === 'order')
      await createOrderFromEvent(connection, input.provider, event.payload);
    else
      await createPostSaleAlert(
        connection,
        input.provider,
        event.type,
        event.resourceId,
        event.payload,
      );
    await getD1()
      .prepare(
        `UPDATE sales_channel_events SET status='processed',processed_at=? WHERE id=?`,
      )
      .bind(new Date().toISOString(), id)
      .run();
    return { duplicate: false, accepted: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao processar evento';
    await getD1()
      .prepare(
        `UPDATE sales_channel_events SET status='failed',error=?,processed_at=? WHERE id=?`,
      )
      .bind(message, new Date().toISOString(), id)
      .run();
    throw error;
  }
}

async function createPostSaleAlert(
  connection: Connection,
  provider: MarketplaceProvider,
  type: string,
  resourceId: string | undefined,
  payload: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const labels: Record<string, string> = {
    question: 'Nova pergunta no marketplace',
    return: 'Nova devolução no marketplace',
    cancellation: 'Cancelamento no marketplace',
    order_status: 'Pedido atualizado no marketplace',
  };
  await getD1()
    .prepare(
      `INSERT INTO notifications (id,user_id,organization_id,type,title,body,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      connection.createdBy,
      connection.organizationId,
      `marketplace.${type}`,
      labels[type] ?? 'Atualização do marketplace',
      `Acesse o canal para tratar o evento ${resourceId ?? ''}.`,
      'sales_channel_event',
      scalar(payload.eventId) || resourceId || '',
      now,
    )
    .run();
}

async function createOrderFromEvent(
  connection: Connection,
  provider: MarketplaceProvider,
  payload: Record<string, unknown>,
) {
  const externalOrderId = scalar(payload.orderId);
  const externalListingId = scalar(payload.listingId);
  const quantity = Math.max(1, Number(payload.quantity ?? 1));
  if (!externalOrderId || !externalListingId || !Number.isSafeInteger(quantity))
    throw new Error('ORDER_PAYLOAD_INVALID');
  const duplicate = await getD1()
    .prepare(
      `SELECT id FROM sales_channel_order_links WHERE provider=? AND connection_id=? AND external_order_id=?`,
    )
    .bind(provider, connection.id, externalOrderId)
    .first();
  if (duplicate) return;
  const listing = await getD1()
    .prepare(
      `SELECT l.product_id productId,l.variant_id variantId,l.cost_snapshot_cents costCents,p.organization_id supplierId,p.title,COALESCE(v.sku,p.sku) sku,o.commission_basis_points commission,CASE WHEN v.id IS NULL THEN COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id=p.id),0) ELSE v.stock END stock,COALESCE((SELECT SUM(quantity) FROM inventory_reservations WHERE product_id=p.id AND variant_id IS NOT DISTINCT FROM l.variant_id AND status='active' AND expires_at>?),0) reserved FROM sales_channel_listings l JOIN products p ON p.id=l.product_id JOIN supplier_offers o ON o.product_id=p.id LEFT JOIN product_variants v ON v.id=l.variant_id WHERE l.connection_id=? AND l.external_listing_id=? AND l.status IN ('active','paused')`,
    )
    .bind(new Date().toISOString(), connection.id, externalListingId)
    .first<{
      productId: string;
      variantId: string | null;
      costCents: number;
      supplierId: string;
      title: string;
      sku: string;
      commission: number;
      stock: number;
      reserved: number;
    }>();
  if (!listing) throw new Error('ORDER_LISTING_NOT_LINKED');
  if (quantity > listing.stock - listing.reserved)
    throw new Error('ORDER_INSUFFICIENT_STOCK');
  const recipient =
    payload.recipient && typeof payload.recipient === 'object'
      ? payload.recipient
      : {
          name: 'Cliente do marketplace',
          document: 'Não informado',
          phone: 'Não informado',
        };
  const address =
    payload.address && typeof payload.address === 'object'
      ? payload.address
      : {
          postalCode: '',
          street: 'Endereço protegido pelo canal',
          number: '',
          district: '',
          city: '',
          state: '',
        };
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60_000);
  const orderId = crypto.randomUUID();
  const total = listing.costCents * quantity;
  const payment = await getPaymentProvider().createPixCharge({
    orderId,
    amountCents: total,
    expiresAt: expires.toISOString(),
    idempotencyKey: `marketplace:${provider}:${connection.id}:${externalOrderId}`,
  });
  const number = `FLB-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${orderId.slice(0, 8).toUpperCase()}`;
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO orders (id,number,reseller_organization_id,supplier_organization_id,status,channel,external_reference,recipient_snapshot,address_snapshot,subtotal_cents,commission_cents,total_cents,notes,created_by,created_at,updated_at) VALUES (?,?,?,?,'awaiting_payment',?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        orderId,
        number,
        connection.organizationId,
        listing.supplierId,
        provider,
        externalOrderId,
        JSON.stringify(recipient),
        JSON.stringify(address),
        total,
        Math.round((total * listing.commission) / 10000),
        total,
        'Venda importada do marketplace; pagamento do custo em até 30 minutos.',
        connection.createdBy,
        now.toISOString(),
        now.toISOString(),
      ),
    getD1()
      .prepare(
        `INSERT INTO order_items (id,order_id,product_id,variant_id,quantity,product_snapshot,unit_price_cents,commission_basis_points,subtotal_cents) VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        listing.productId,
        listing.variantId,
        quantity,
        JSON.stringify({
          title: listing.title,
          sku: listing.sku,
          externalListingId,
        }),
        listing.costCents,
        listing.commission,
        total,
      ),
    getD1()
      .prepare(
        `INSERT INTO inventory_reservations (id,order_id,product_id,variant_id,quantity,status,expires_at,created_at) VALUES (?,?,?,?,?,'active',?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        listing.productId,
        listing.variantId,
        quantity,
        expires.toISOString(),
        now.toISOString(),
      ),
    getD1()
      .prepare(
        `INSERT INTO payment_intents (id,order_id,provider,external_id,status,amount_cents,pix_copy_paste,expires_at,created_at,updated_at) VALUES (?,?,?,?, 'pending',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        getPaymentProvider().name,
        payment.externalId,
        total,
        payment.copyPaste,
        expires.toISOString(),
        now.toISOString(),
        now.toISOString(),
      ),
    getD1()
      .prepare(
        `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,'marketplace.order_imported','created','awaiting_payment',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        connection.createdBy,
        JSON.stringify({ provider, externalOrderId }),
        now.toISOString(),
      ),
    getD1()
      .prepare(
        `INSERT INTO sales_channel_order_links (id,connection_id,order_id,provider,external_order_id,external_status,external_snapshot_json,external_url,last_synced_at,created_at) VALUES (?,?,?,?,?,'paid',?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        connection.id,
        orderId,
        provider,
        externalOrderId,
        JSON.stringify(payload),
        scalar(payload.url) || null,
        now.toISOString(),
        now.toISOString(),
      ),
    getD1()
      .prepare(
        `INSERT INTO notifications (id,user_id,organization_id,type,title,body,entity_type,entity_id,created_at) VALUES (?,?,?,'marketplace.order','Nova venda no marketplace',?,'order',?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        connection.createdBy,
        connection.organizationId,
        `Pague o custo do pedido ${number} em até 30 minutos.`,
        orderId,
        now.toISOString(),
      ),
  ]);
}
