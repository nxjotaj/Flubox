import { createServerClient } from '@supabase/ssr';
import postgres from 'postgres';

const password = process.env.SMOKE_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
if (!password || !url || !key || !process.env.DATABASE_URL)
  throw new Error('Ambiente incompleto.');

async function session(email) {
  const jar = new Map();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) =>
        items.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(label, path, cookie, options = {}, expected = [200]) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { cookie, ...options.headers },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  const ok =
    expected.includes(response.status) &&
    !/Internal Server Error|PostgresError/.test(body);
  console.log(JSON.stringify({ label, status: response.status, ok }));
  if (!ok)
    throw new Error(`${label}: ${response.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : {};
}

const [reseller, supplier] = await Promise.all([
  session('revendedor@flubox.com.br'),
  session('fornecedor@flubox.com.br'),
]);
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  prepare: false,
});
const [product] = await sql`
  SELECT p.id,(SELECT id FROM product_variants v WHERE v.product_id=p.id AND v.status='active' AND v.stock>0 ORDER BY created_at LIMIT 1) variant_id FROM products p
  JOIN organization_members m ON m.organization_id=p.organization_id
  JOIN users u ON u.id=m.user_id
  JOIN organizations o ON o.id=p.organization_id AND o.status='active'
  JOIN subscriptions s ON s.organization_id=o.id AND s.status IN ('active','grace_period')
  WHERE u.email='fornecedor@flubox.com.br' AND p.status='approved'
  AND COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id=p.id),0)>0
  ORDER BY p.created_at LIMIT 1`;
if (!product) throw new Error('Produto elegível ausente.');
const [resellerOrg] =
  await sql`SELECT o.id,u.id user_id FROM organizations o JOIN organization_members m ON m.organization_id=o.id JOIN users u ON u.id=m.user_id WHERE u.email='revendedor@flubox.com.br' AND o.type='reseller' LIMIT 1`;
await sql`INSERT INTO product_favorites (organization_id,product_id,created_by,created_at) VALUES (${resellerOrg.id},${product.id},${resellerOrg.user_id},NOW()) ON CONFLICT (organization_id,product_id) DO NOTHING`;

let [order] =
  await sql`SELECT id,status FROM orders WHERE channel='auditoria_e2e' AND status IN ('awaiting_payment','paid_awaiting_documents') ORDER BY created_at DESC LIMIT 1`;
order ??= await request(
  'criar pedido e PIX',
  '/api/orders',
  reseller,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          productId: product.id,
          variantId: product.variant_id ?? undefined,
          quantity: 1,
        },
      ],
      channel: 'auditoria_e2e',
      externalReference: `E2E-${Date.now()}`,
      recipient: {
        name: 'Cliente Auditoria',
        document: '39053344705',
        phone: '11999999999',
      },
      address: {
        postalCode: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        district: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
      notes: 'Pedido criado pela auditoria operacional completa.',
    }),
  },
  [201],
);
if (order.status !== 'paid_awaiting_documents')
  await request(
    'confirmar PIX de desenvolvimento',
    `/api/orders/${order.id}/payment/confirm`,
    reseller,
    { method: 'POST' },
  );

const pdf = new File(
  [new TextEncoder().encode('%PDF-1.4\n% Flubox E2E\n%%EOF')],
  'auditoria.pdf',
  { type: 'application/pdf' },
);
for (const [type, label] of [
  ['shipping_label', 'enviar etiqueta'],
  ['content_declaration', 'enviar declaração fiscal'],
]) {
  const [existingDocument] =
    await sql`SELECT id FROM order_documents WHERE order_id=${order.id} AND type=${type} LIMIT 1`;
  if (existingDocument && type === 'shipping_label') continue;
  const form = new FormData();
  form.set('type', type);
  form.set('issuer', 'Auditoria Flubox');
  form.set('file', pdf, `${type}.pdf`);
  await request(
    label,
    `/api/orders/${order.id}/documents`,
    reseller,
    { method: 'POST', body: form },
    [201],
  );
}

for (const [action, label, extra] of [
  ['accept', 'iniciar preparação', {}],
  ['ready', 'marcar pronto para envio', {}],
  [
    'ship',
    'postar pedido',
    { carrier: 'Transportadora E2E', trackingCode: `E2E${Date.now()}` },
  ],
])
  await request(label, `/api/orders/${order.id}/logistics`, supplier, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });

await request(
  'registrar rastreio',
  `/api/orders/${order.id}/tracking`,
  supplier,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      status: 'in_transit',
      description: 'Objeto em transferência na auditoria',
      location: 'São Paulo/SP',
      occurredAt: new Date().toISOString(),
    }),
  },
  [201],
);
await request(
  'confirmar entrega',
  `/api/orders/${order.id}/logistics`,
  supplier,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'deliver' }),
  },
);

const [verification] = await sql`
  SELECT o.id,o.status,
    (SELECT COUNT(*)::int FROM order_documents d WHERE d.order_id=o.id) documents,
    (SELECT COUNT(*)::int FROM ledger_entries l WHERE l.order_id=o.id) ledger_entries,
    (SELECT COUNT(*)::int FROM tracking_events t JOIN shipments s ON s.id=t.shipment_id WHERE s.order_id=o.id) tracking_events
  FROM orders o WHERE o.id=${order.id}`;
await sql.end();
if (
  verification?.status !== 'delivered' ||
  verification.documents < 2 ||
  verification.ledger_entries < 2 ||
  verification.tracking_events < 2
)
  throw new Error(`Fluxo incompleto: ${JSON.stringify(verification)}`);
console.log(
  JSON.stringify({
    label: 'verificação final',
    orderId: order.id,
    ...verification,
    ok: true,
  }),
);
