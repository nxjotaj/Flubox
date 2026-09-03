import { createServerClient } from '@supabase/ssr';
import postgres from 'postgres';

const password = process.env.SMOKE_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
if (!password || !url || !key || !process.env.DATABASE_URL)
  throw new Error('Ambiente incompleto.');

async function cookieFor(email) {
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

async function check(label, path, cookie, options, expected) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      cookie,
      'content-type': 'application/json',
      ...options?.headers,
    },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.text();
  const ok =
    expected.includes(response.status) &&
    !/PostgresError|Internal Server Error/.test(body);
  console.log(JSON.stringify({ label, status: response.status, ok }));
  if (!ok)
    throw new Error(
      `${label}: status ${response.status}: ${body.slice(0, 300)}`,
    );
  return body;
}

const admin = await cookieFor('admin@flubox.com.br');
const supplier = await cookieFor('fornecedor@flubox.com.br');
const reseller = await cookieFor('revendedor@flubox.com.br');
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  prepare: false,
});
const [product] =
  await sql`SELECT id FROM products WHERE status='approved' ORDER BY created_at LIMIT 1`;
const [supplierOrg] =
  await sql`SELECT id,status FROM organizations WHERE type='supplier' LIMIT 1`;
const [supplierMember] =
  await sql`SELECT m.id,m.status FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE o.type='supplier' LIMIT 1`;

await check('health', '/api/health', admin, {}, [200]);
await check(
  'ledger csv',
  '/api/finance/ledger.csv',
  supplier,
  { headers: { accept: 'text/csv' } },
  [200],
);
await check(
  'produto inválido',
  '/api/products',
  supplier,
  { method: 'POST', body: '{}' },
  [422],
);
await check(
  'estoque inválido',
  `/api/products/${product.id}/inventory`,
  supplier,
  { method: 'POST', body: '{}' },
  [422],
);
await check(
  'bloqueio de fornecedor no favorito',
  `/api/favorites/${product.id}`,
  supplier,
  { method: 'POST' },
  [403],
);
await check(
  'favoritar',
  `/api/favorites/${product.id}`,
  reseller,
  { method: 'POST' },
  [200],
);
await check(
  'desfavoritar',
  `/api/favorites/${product.id}`,
  reseller,
  { method: 'POST' },
  [200],
);
const listBody = await check(
  'criar lista',
  '/api/lists',
  reseller,
  { method: 'POST', body: JSON.stringify({ name: 'Auditoria automática' }) },
  [201],
);
const listId = JSON.parse(listBody).id;
await check(
  'marcar notificações',
  '/api/notifications/read',
  supplier,
  { method: 'POST' },
  [200],
);
await check(
  'recalcular reputação',
  '/api/admin/reputation/recalculate',
  admin,
  { method: 'POST', body: '{}' },
  [200],
);
await check(
  'avaliar assinaturas',
  '/api/admin/subscriptions/evaluate',
  admin,
  { method: 'POST', body: '{}' },
  [200],
);
await check(
  'expirar pedidos',
  '/api/admin/orders/expire',
  admin,
  { method: 'POST', body: '{}' },
  [200],
);
await check(
  'suspender organização',
  `/api/admin/organizations/${supplierOrg.id}/status`,
  admin,
  {
    method: 'POST',
    body: JSON.stringify({
      status: 'suspended',
      reason: 'Teste automatizado de autorização',
    }),
  },
  [200],
);
await check(
  'reativar organização',
  `/api/admin/organizations/${supplierOrg.id}/status`,
  admin,
  {
    method: 'POST',
    body: JSON.stringify({
      status: supplierOrg.status,
      reason: 'Restauração após teste automatizado',
    }),
  },
  [200],
);
await check(
  'revogar membro',
  `/api/admin/members/${encodeURIComponent(supplierMember.id)}/status`,
  admin,
  {
    method: 'POST',
    body: JSON.stringify({
      status: 'revoked',
      reason: 'Teste automatizado de autorização',
    }),
  },
  [200],
);
await check(
  'restaurar membro',
  `/api/admin/members/${encodeURIComponent(supplierMember.id)}/status`,
  admin,
  {
    method: 'POST',
    body: JSON.stringify({
      status: supplierMember.status,
      reason: 'Restauração após teste automatizado',
    }),
  },
  [200],
);
await check(
  'salvar configurações',
  '/api/admin/settings',
  admin,
  {
    method: 'POST',
    body: JSON.stringify({
      values: {
        commission_basis_points: '1000',
        supplier_monthly_fee_cents: '1990',
        subscription_grace_days: '7',
        pix_expiration_minutes: '30',
        dispute_window_days: '7',
        max_upload_megabytes: '10',
      },
      reason: 'Validação automatizada das configurações',
    }),
  },
  [200],
);

if (listId) await sql`DELETE FROM product_lists WHERE id=${listId}`;
await sql.end();
