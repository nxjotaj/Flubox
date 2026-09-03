import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { ensureDatabase } from '@/db/initialize';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  syncAuthenticatedUser,
} from '@/modules/identity/service';

const profiles = {
  admin: {
    organizationId: '00000000-0000-4000-8000-000000000001',
    type: 'platform',
    role: 'platform_admin',
    name: 'Flubox Administração',
  },
  supplier: {
    organizationId: '00000000-0000-4000-8000-000000000002',
    type: 'supplier',
    role: 'supplier_owner',
    name: 'Fornecedor Demonstração',
  },
  reseller: {
    organizationId: '00000000-0000-4000-8000-000000000003',
    type: 'reseller',
    role: 'reseller_owner',
    name: 'Revendedor Demonstração',
  },
} as const;

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development')
    return new Response('Not found', { status: 404 });
  const authUser = await getAuthenticatedUser();
  if (!authUser)
    return Response.json(
      { error: 'Identidade local ausente.' },
      { status: 401 },
    );
  const role = new URL(request.url).searchParams.get('role');
  const profile = profiles[role as keyof typeof profiles];
  if (!profile)
    return Response.json(
      { error: 'Conta local desconhecida.' },
      { status: 403 },
    );
  await ensureDatabase();
  const userId = await syncAuthenticatedUser(authUser);
  const now = new Date().toISOString();
  const statements = [
    getD1()
      .prepare(
        `INSERT INTO organizations (id,type,legal_name,display_name,status,created_at,updated_at) VALUES (?,?,?,?, 'active',?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,status='active',updated_at=excluded.updated_at`,
      )
      .bind(
        profile.organizationId,
        profile.type,
        profile.name,
        profile.name,
        now,
        now,
      ),
    getD1()
      .prepare(
        `INSERT INTO organization_members (id,organization_id,user_id,role_id,status,created_at) VALUES (?,?,?,?,'active',?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role_id=excluded.role_id,status='active'`,
      )
      .bind(
        `test-member-${profile.organizationId}`,
        profile.organizationId,
        userId,
        `role:${profile.role}`,
        now,
      ),
  ];
  if (profile.type === 'supplier') {
    statements.push(
      getD1()
        .prepare(
          `INSERT INTO supplier_profiles (organization_id,cnpj,legal_name,trade_name,responsible_name,responsible_cpf,responsible_email,responsible_phone,reputation_basis_points,onboarding_step,created_at,updated_at) VALUES (?,'99999999000199',?,?, 'Fornecedor Teste','39053344705',?,'11999999999',10000,3,?,?) ON CONFLICT(organization_id) DO UPDATE SET onboarding_step=3,updated_at=excluded.updated_at`,
        )
        .bind(
          profile.organizationId,
          profile.name,
          profile.name,
          authUser.email,
          now,
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO subscriptions (id,organization_id,status,monthly_amount_cents,grace_period_days,provider,created_at,updated_at) VALUES ('test-subscription-supplier-v2',?,'active',1990,7,'test',?,?) ON CONFLICT(organization_id) DO UPDATE SET status='active',updated_at=excluded.updated_at`,
        )
        .bind(profile.organizationId, now, now),
      getD1()
        .prepare(
          `INSERT OR IGNORE INTO categories (id,name,slug,status,created_at,updated_at) VALUES ('test-category-general','Utilidades','utilidades-teste','active',?,?)`,
        )
        .bind(now, now),
      getD1()
        .prepare(
          `INSERT INTO products (id,organization_id,category_id,sku,title,description,brand,status,quality_score,created_at,updated_at) VALUES ('00000000-0000-4000-8000-000000000101',?,'test-category-general','DEMO-001','Produto demonstração','Produto aprovado para validar catálogo, estoque e pedidos entre contas locais.','Flubox Demo','approved',100,?,?) ON CONFLICT(id) DO UPDATE SET organization_id=excluded.organization_id,status='approved',updated_at=excluded.updated_at`,
        )
        .bind(profile.organizationId, now, now),
      getD1()
        .prepare(
          `INSERT INTO supplier_offers (id,product_id,organization_id,price_cents,suggested_retail_cents,commission_basis_points,preparation_days,created_at,updated_at) VALUES ('test-offer-supplier-v2','00000000-0000-4000-8000-000000000101',?,7990,10990,1000,1,?,?) ON CONFLICT(product_id) DO UPDATE SET organization_id=excluded.organization_id,price_cents=7990,updated_at=excluded.updated_at`,
        )
        .bind(profile.organizationId, now, now),
      getD1()
        .prepare(
          `INSERT OR IGNORE INTO inventory_movements (id,product_id,organization_id,type,quantity,reference_type,reference_id,created_by,created_at) VALUES ('test-inventory-supplier-v2','00000000-0000-4000-8000-000000000101',?,'initial',100,'test_seed','00000000-0000-4000-8000-000000000101',?,?)`,
        )
        .bind(profile.organizationId, userId, now),
    );
  }
  if (profile.type === 'reseller') {
    statements.push(
      getD1()
        .prepare(
          `INSERT INTO reseller_profiles (organization_id,person_type,cpf,full_name,phone,onboarding_step,created_at,updated_at) VALUES (?,'individual','16899535009','Revendedor Teste','11988888888',3,?,?) ON CONFLICT(organization_id) DO UPDATE SET onboarding_step=3,updated_at=excluded.updated_at`,
        )
        .bind(profile.organizationId, now, now),
    );
  }
  await getD1().batch(statements);
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL('/dashboard', request.url).toString(),
      'set-cookie': `${ACTIVE_ORGANIZATION_COOKIE}=${profile.organizationId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    },
  });
}
