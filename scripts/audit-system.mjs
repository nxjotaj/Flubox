import { createServerClient } from '@supabase/ssr';
import postgres from 'postgres';

const password = process.env.SMOKE_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
if (!password || !supabaseUrl || !supabaseKey || !databaseUrl)
  throw new Error('Ambiente incompleto.');

const sql = postgres(databaseUrl, { ssl: 'require', max: 1, prepare: false });
const [order] =
  await sql`SELECT id FROM orders ORDER BY created_at DESC LIMIT 1`;
const [product] =
  await sql`SELECT p.id FROM products p JOIN organizations o ON o.id=p.organization_id AND o.status='active' JOIN subscriptions s ON s.organization_id=o.id AND s.status IN ('active','grace_period') WHERE p.status='approved' ORDER BY p.created_at LIMIT 1`;
const [supplierProduct] =
  await sql`SELECT p.id FROM products p JOIN organization_members m ON m.organization_id=p.organization_id JOIN users u ON u.id=m.user_id WHERE u.email='fornecedor@flubox.com.br' ORDER BY p.created_at LIMIT 1`;
const [supplierOrg] =
  await sql`SELECT id FROM organizations WHERE type='supplier' LIMIT 1`;
const [resellerOrg] =
  await sql`SELECT id FROM organizations WHERE type='reseller' LIMIT 1`;
const [member] =
  await sql`SELECT id FROM organization_members ORDER BY created_at LIMIT 1`;
const [supportCase] =
  await sql`SELECT id FROM support_cases ORDER BY created_at LIMIT 1`;
await sql.end();

const profiles = [
  {
    email: 'admin@flubox.com.br',
    routes: [
      '/admin',
      '/admin/fornecedores',
      '/admin/revendedores',
      '/admin/usuarios',
      '/admin/catalogo',
      '/admin/pedidos',
      '/admin/financeiro',
      '/admin/disputas',
      '/admin/relatorios',
      '/admin/auditoria',
      '/notificacoes',
      '/configuracoes',
    ],
  },
  {
    email: 'fornecedor@flubox.com.br',
    routes: [
      '/dashboard',
      '/produtos',
      '/estoque',
      '/pedidos',
      '/envios',
      '/financeiro',
      '/relatorios',
      '/casos',
      '/mensagens',
      '/equipe',
      '/assinatura',
      '/notificacoes',
      '/configuracoes',
    ],
  },
  {
    email: 'revendedor@flubox.com.br',
    routes: [
      '/dashboard',
      '/fornecedores',
      '/catalogo',
      '/favoritos',
      '/listas',
      '/carrinho',
      '/pedidos',
      '/rastreamento',
      '/financeiro',
      '/relatorios',
      '/casos',
      '/mensagens',
      '/notificacoes',
      '/configuracoes',
    ],
  },
];
if (order?.id)
  profiles.forEach((profile) =>
    profile.routes.push(
      `/pedidos/${order.id}`,
      `/pedidos/${order.id}/imprimir`,
    ),
  );
if (product?.id)
  profiles[2].routes.push(`/catalogo/${product.id}`, `/checkout/${product.id}`);
if (supplierProduct?.id)
  profiles[1].routes.push(`/produtos/${supplierProduct.id}`);
if (supplierOrg?.id)
  profiles[0].routes.push(`/admin/fornecedores/${supplierOrg.id}`);
if (supplierOrg?.id)
  profiles[2].routes.push(`/fornecedores/${supplierOrg.id}`);
if (resellerOrg?.id)
  profiles[0].routes.push(`/admin/revendedores/${resellerOrg.id}`);
if (member?.id)
  profiles[0].routes.push(`/admin/usuarios/${encodeURIComponent(member.id)}`);
if (product?.id) profiles[0].routes.push(`/admin/catalogo/${product.id}`);
if (supportCase?.id)
  profiles[0].routes.push(`/admin/disputas/${supportCase.id}`);

let failures = 0;
for (const profile of profiles) {
  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) =>
        items.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  });
  if (error) throw error;
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  for (const route of profile.routes) {
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${route}`, {
        headers: { cookie },
        redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
      });
      const html = await response.text();
      const hasError =
        /Internal Server Error|Application error|Não foi possível carregar|PostgresError|NEXT_HTTP_ERROR_FALLBACK/.test(
          html,
        );
      const redirectedToLogin = new URL(response.url).pathname === '/entrar';
      const ok = response.ok && !hasError && !redirectedToLogin;
      if (!ok) failures++;
      console.log(
        JSON.stringify({
          email: profile.email,
          route,
          status: response.status,
          final: new URL(response.url).pathname,
          ms: Math.round(performance.now() - started),
          ok,
        }),
      );
    } catch (error) {
      failures++;
      console.log(
        JSON.stringify({
          email: profile.email,
          route,
          error: error.name,
          ok: false,
        }),
      );
    }
  }
}
if (failures) throw new Error(`${failures} rota(s) falharam.`);
