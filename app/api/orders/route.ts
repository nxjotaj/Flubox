import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getAccountContext } from '@/modules/identity/service';
import {
  getPaymentProvider,
  PaymentProviderUnavailableError,
} from '@/modules/payments/provider';
import { assessOrderRisk } from '@/modules/risk/order-risk';
import { z } from 'zod';

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        variantId: z.uuid().optional(),
        quantity: z.int().min(1).max(100),
      }),
    )
    .min(1)
    .max(20),
  channel: z.string().trim().min(2).max(40),
  externalReference: z.string().trim().max(100).optional(),
  recipient: z.object({
    name: z.string().trim().min(3).max(120),
    document: z.string().trim().min(5).max(30),
    phone: z.string().trim().min(8).max(30),
  }),
  address: z.object({
    postalCode: z.string().trim().min(8).max(10),
    street: z.string().trim().min(3).max(150),
    number: z.string().trim().min(1).max(20),
    complement: z.string().trim().max(80).optional(),
    district: z.string().trim().min(2).max(80),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().length(2),
  }),
  notes: z.string().trim().max(500).optional(),
});
type Offer = {
  id: string;
  key: string;
  variantId: string | null;
  variantName: string | null;
  variantSku: string | null;
  title: string;
  sku: string;
  organizationId: string;
  priceCents: number;
  commission: number;
  stock: number;
  reserved: number;
};
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
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
    const rateLimit = await consumeRateLimit(
      `orders:${account.user.id}`,
      20,
      3600,
    );
    if (!rateLimit.allowed)
      return Response.json(
        { error: 'Limite temporário de pedidos atingido.', requestId },
        { status: 429 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Revise itens, destinatário e endereço.', requestId },
        { status: 422 },
      );
    const consolidated = new Map<
      string,
      { productId: string; variantId: string | null; quantity: number }
    >();
    for (const item of parsed.data.items) {
      const key = `${item.productId}:${item.variantId ?? ''}`;
      const current = consolidated.get(key);
      consolidated.set(key, {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: (current?.quantity ?? 0) + item.quantity,
      });
    }
    const offers = await Promise.all(
      [...consolidated].map(async ([key, item]) => {
        const offer = await getD1()
          .prepare(
            `SELECT p.id,p.title,p.sku,p.organization_id organizationId,pv.id variantId,pv.name variantName,pv.sku variantSku,COALESCE(pv.price_cents,o.price_cents) priceCents,o.commission_basis_points commission,CASE WHEN pv.id IS NOT NULL THEN pv.stock ELSE COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id=p.id),0) END stock,COALESCE((SELECT SUM(quantity) FROM inventory_reservations WHERE product_id=p.id AND variant_id IS NOT DISTINCT FROM ? AND status='active' AND expires_at>?),0) reserved FROM products p JOIN supplier_offers o ON o.product_id=p.id JOIN organizations org ON org.id=p.organization_id AND org.status='active' JOIN subscriptions sub ON sub.organization_id=org.id AND sub.status IN ('active','grace_period') JOIN product_favorites pf ON pf.product_id=p.id AND pf.organization_id=? LEFT JOIN product_variants pv ON pv.id=? AND pv.product_id=p.id AND pv.status='active' WHERE p.id=? AND p.status='approved' AND (? IS NULL OR pv.id IS NOT NULL)`,
          )
          .bind(
            item.variantId,
            new Date().toISOString(),
            account.organization.id,
            item.variantId,
            item.productId,
            item.variantId,
          )
          .first<Omit<Offer, 'key'>>();
        return offer ? { ...offer, key } : null;
      }),
    );
    if (offers.some((offer) => !offer))
      return Response.json(
        { error: 'Um ou mais produtos não estão disponíveis.', requestId },
        { status: 409 },
      );
    const available = offers as Offer[];
    if (new Set(available.map((offer) => offer.organizationId)).size !== 1)
      return Response.json(
        {
          error: 'Cada pedido deve conter produtos de um único fornecedor.',
          requestId,
        },
        { status: 422 },
      );
    for (const offer of available)
      if (
        (consolidated.get(offer.key)?.quantity ?? 0) >
        offer.stock - offer.reserved
      ) {
        const requestedQuantity = consolidated.get(offer.key)?.quantity ?? 0;
        const availableQuantity = offer.stock - offer.reserved;
        await getD1()
          .prepare(
            `INSERT INTO order_anomalies (id,reseller_organization_id,supplier_organization_id,product_id,type,requested_quantity,available_quantity,metadata,created_by,created_at) VALUES (?,?,?,?, 'insufficient_stock',?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            account.organization.id,
            offer.organizationId,
            offer.id,
            requestedQuantity,
            availableQuantity,
            JSON.stringify({
              title: offer.title,
              channel: parsed.data.channel,
            }),
            account.user.id,
            new Date().toISOString(),
          )
          .run();
        return Response.json(
          { error: `Estoque insuficiente para ${offer.title}.`, requestId },
          { status: 409 },
        );
      }
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 60_000);
    const id = crypto.randomUUID();
    const number = `FLB-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${id.slice(0, 8).toUpperCase()}`;
    const subtotal = available.reduce(
      (sum, offer) =>
        sum + offer.priceCents * (consolidated.get(offer.key)?.quantity ?? 0),
      0,
    );
    const commission = available.reduce(
      (sum, offer) =>
        sum +
        Math.round(
          (offer.priceCents *
            (consolidated.get(offer.key)?.quantity ?? 0) *
            offer.commission) /
            10000,
        ),
      0,
    );
    const recent = await getD1()
      .prepare(
        `SELECT COUNT(*) total FROM orders WHERE reseller_organization_id=? AND status IN ('created','awaiting_payment') AND created_at>?`,
      )
      .bind(
        account.organization.id,
        new Date(now.getTime() - 3600000).toISOString(),
      )
      .first<{ total: number }>();
    const reusedReference = parsed.data.externalReference
      ? await getD1()
          .prepare(
            `SELECT id FROM orders WHERE reseller_organization_id=? AND external_reference=? LIMIT 1`,
          )
          .bind(account.organization.id, parsed.data.externalReference)
          .first()
      : null;
    const risk = assessOrderRisk({
      amountCents: subtotal,
      quantity: [...consolidated.values()].reduce(
        (sum, value) => sum + value.quantity,
        0,
      ),
      unpaidOrdersLastHour: recent?.total ?? 0,
      reusedExternalReference: Boolean(reusedReference),
    });
    let payment;
    try {
      payment = await getPaymentProvider().createPixCharge({
        orderId: id,
        amountCents: subtotal,
        expiresAt: expires.toISOString(),
        idempotencyKey: `order:${id}:pix`,
      });
    } catch (error) {
      if (error instanceof PaymentProviderUnavailableError)
        return Response.json(
          {
            error:
              'O provedor de pagamento ainda não está configurado. Nenhum pedido foi criado.',
            requestId,
          },
          { status: 503 },
        );
      throw error;
    }
    const statements = [
      getD1()
        .prepare(
          `INSERT INTO orders (id,number,reseller_organization_id,supplier_organization_id,status,channel,external_reference,recipient_snapshot,address_snapshot,subtotal_cents,commission_cents,total_cents,notes,created_by,created_at,updated_at) VALUES (?,?,?,?,'awaiting_payment',?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          id,
          number,
          account.organization.id,
          available[0].organizationId,
          parsed.data.channel,
          parsed.data.externalReference ?? null,
          JSON.stringify(parsed.data.recipient),
          JSON.stringify(parsed.data.address),
          subtotal,
          commission,
          subtotal,
          parsed.data.notes ?? null,
          account.user.id,
          now.toISOString(),
          now.toISOString(),
        ),
      getD1()
        .prepare(
          `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,'order.created','created','awaiting_payment',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          account.user.id,
          JSON.stringify({ channel: parsed.data.channel }),
          now.toISOString(),
        ),
      getD1()
        .prepare(
          `INSERT INTO payment_intents (id,order_id,provider,external_id,status,amount_cents,pix_copy_paste,expires_at,created_at,updated_at) VALUES (?,?,?,?, 'pending',?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          getPaymentProvider().name,
          payment.externalId,
          subtotal,
          payment.copyPaste,
          expires.toISOString(),
          now.toISOString(),
          now.toISOString(),
        ),
      getD1()
        .prepare(
          `INSERT INTO risk_assessments (id,order_id,organization_id,score,decision,signals_json,created_at) VALUES (?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          account.organization.id,
          risk.score,
          risk.decision,
          JSON.stringify(risk.signals),
          now.toISOString(),
        ),
    ];
    for (const offer of available) {
      const quantity = consolidated.get(offer.key)?.quantity ?? 0;
      statements.push(
        getD1()
          .prepare(
            'INSERT INTO order_items (id,order_id,product_id,variant_id,quantity,product_snapshot,unit_price_cents,commission_basis_points,subtotal_cents) VALUES (?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            crypto.randomUUID(),
            id,
            offer.id,
            offer.variantId,
            quantity,
            JSON.stringify({
              title: offer.title,
              sku: offer.variantSku ?? offer.sku,
              variant: offer.variantName,
            }),
            offer.priceCents,
            offer.commission,
            offer.priceCents * quantity,
          ),
      );
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO inventory_reservations (id,order_id,product_id,variant_id,quantity,status,expires_at,created_at) VALUES (?,?,?,?,?,'active',?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            offer.id,
            offer.variantId,
            quantity,
            expires.toISOString(),
            now.toISOString(),
          ),
      );
    }
    await getD1().batch(statements);
    const reserved = await getD1()
      .prepare(
        `SELECT COALESCE(SUM(quantity),0) total FROM inventory_reservations WHERE order_id=? AND status='active'`,
      )
      .bind(id)
      .first<{ total: number }>();
    const requestedQuantity = [...consolidated.values()].reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const reservedQuantity = Number(reserved?.total ?? 0);
    if (reservedQuantity !== requestedQuantity) {
      const failedAt = new Date().toISOString();
      await getD1().batch([
        getD1()
          .prepare(
            `UPDATE orders SET status='cancelled',updated_at=? WHERE id=?`,
          )
          .bind(failedAt, id),
        getD1()
          .prepare(
            `UPDATE inventory_reservations SET status='released',released_at=? WHERE order_id=? AND status='active'`,
          )
          .bind(failedAt, id),
        getD1()
          .prepare(
            `UPDATE payment_intents SET status='cancelled',updated_at=? WHERE order_id=?`,
          )
          .bind(failedAt, id),
        getD1()
          .prepare(
            `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,metadata,created_at) VALUES (?,?,'inventory.reservation_failed','awaiting_payment','cancelled',?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            account.user.id,
            JSON.stringify({
              requestedQuantity,
              reserved: reservedQuantity,
            }),
            failedAt,
          ),
        ...available.map((offer) =>
          getD1()
            .prepare(
              `INSERT INTO order_anomalies (id,reseller_organization_id,supplier_organization_id,product_id,type,requested_quantity,available_quantity,metadata,created_by,created_at) VALUES (?,?,?,?, 'reservation_race',?,?,?,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              account.organization.id,
              offer.organizationId,
              offer.id,
              consolidated.get(offer.key)?.quantity ?? 0,
              offer.stock - offer.reserved,
              JSON.stringify({ orderId: id }),
              account.user.id,
              failedAt,
            ),
        ),
      ]);
      return Response.json(
        {
          error:
            'O estoque mudou durante a reserva. Atualize o catálogo e tente novamente.',
          requestId,
        },
        { status: 409 },
      );
    }
    await getD1().batch(
      [
        ...new Set([...consolidated.values()].map((item) => item.productId)),
      ].map((productId) =>
        getD1()
          .prepare(
            `DELETE FROM cart_items WHERE organization_id=? AND product_id=?`,
          )
          .bind(account.organization.id, productId),
      ),
    );
    return Response.json(
      {
        id,
        number,
        status: 'awaiting_payment',
        payment: {
          status: 'pending',
          copyPaste: payment.copyPaste,
          amountCents: payment.amountCents,
          expiresAt: payment.expiresAt,
          development: getPaymentProvider().name === 'development',
        },
        requestId,
      },
      { status: 201 },
    );
  } catch (error) {
    logError(error, { requestId, route: 'POST /api/orders' });
    return Response.json(
      {
        error: 'Não foi possível criar o pedido.',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { detail: error.message }
          : {}),
        requestId,
      },
      { status: 500 },
    );
  }
}
