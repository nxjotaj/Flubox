import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  prepare: false,
  max: 1,
});

const now = new Date().toISOString();
const password = process.env.TEST_ACCOUNT_PASSWORD ?? 'Flubox@2026!';
const accounts = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'admin@flubox.com.br',
    name: 'Administrador Flubox',
    organizationId: '20000000-0000-4000-8000-000000000001',
    organization: 'Flubox Operações',
    type: 'platform',
    role: 'platform_admin',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    email: 'fornecedor@flubox.com.br',
    name: 'Marina Fornecedora',
    organizationId: '20000000-0000-4000-8000-000000000002',
    organization: 'Órbita Distribuidora',
    type: 'supplier',
    role: 'supplier_owner',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    email: 'revendedor@flubox.com.br',
    name: 'Lucas Revendedor',
    organizationId: '20000000-0000-4000-8000-000000000003',
    organization: 'Loja Vértice',
    type: 'reseller',
    role: 'reseller_owner',
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    email: 'operador1@flubox.com.br',
    name: 'Operador Expedição 1',
    organizationId: '20000000-0000-4000-8000-000000000002',
    organization: 'Órbita Distribuidora',
    type: 'supplier',
    role: 'supplier_operator_1',
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    email: 'operador2@flubox.com.br',
    name: 'Operador Expedição 2',
    organizationId: '20000000-0000-4000-8000-000000000002',
    organization: 'Órbita Distribuidora',
    type: 'supplier',
    role: 'supplier_operator_2',
  },
];

const tableCount = await sql.unsafe(
  "select count(*)::int total from pg_tables where schemaname='public'",
);
let baseline = await readFile(
  new URL('../drizzle-postgres/0000_supabase_baseline.sql', import.meta.url),
  'utf8',
);
baseline = baseline
  .replaceAll('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ')
  .replaceAll('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ')
  .replaceAll('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ');
for (const statement of tableCount[0].total < 52
  ? baseline.split('--> statement-breakpoint')
  : []) {
  if (!statement.trim()) continue;
  try {
    await sql.unsafe(statement);
  } catch (error) {
    if (!['42P07', '42710'].includes(error.code)) throw error;
  }
}
const booleanColumns = await sql.unsafe(
  `select column_name,data_type from information_schema.columns
   where table_schema='public' and
   ((table_name='category_attributes' and column_name='required') or
    (table_name='webhook_events' and column_name='signature_valid'))`,
);
if (
  booleanColumns.some(
    (column) =>
      column.column_name === 'required' && column.data_type === 'integer',
  )
) {
  await sql.unsafe(
    'ALTER TABLE category_attributes ALTER COLUMN required DROP DEFAULT',
  );
  await sql.unsafe(
    'ALTER TABLE category_attributes ALTER COLUMN required SET DATA TYPE boolean USING (required <> 0)',
  );
  await sql.unsafe(
    'ALTER TABLE category_attributes ALTER COLUMN required SET DEFAULT false',
  );
}
if (
  booleanColumns.some(
    (column) =>
      column.column_name === 'signature_valid' &&
      column.data_type === 'integer',
  )
) {
  await sql.unsafe(
    'ALTER TABLE webhook_events ALTER COLUMN signature_valid SET DATA TYPE boolean USING (signature_valid <> 0)',
  );
}

await sql.begin(async (tx) => {
  for (const [key, name] of [
    ['platform_admin', 'Administrador da plataforma'],
    ['supplier_owner', 'Proprietário fornecedor'],
    ['supplier_member', 'Colaborador fornecedor'],
    ['supplier_operator_1', 'Operador de expedição 1'],
    ['supplier_operator_2', 'Operador de expedição 2'],
    ['reseller_owner', 'Proprietário revendedor'],
    ['reseller_member', 'Colaborador revendedor'],
  ]) {
    await tx.unsafe(
      `INSERT INTO roles (id,key,name,scope,created_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (key) DO UPDATE SET name=excluded.name`,
      [
        `role:${key}`,
        key,
        name,
        key === 'platform_admin' ? 'platform' : 'organization',
        now,
      ],
    );
  }
  for (const account of accounts) {
    await tx.unsafe(
      `INSERT INTO auth.users
       (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
        raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,
        recovery_token,email_change_token_new,email_change)
       VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,
        crypt($3,gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name',$4::text),now(),now(),'','','','')
       ON CONFLICT (id) DO UPDATE SET email=excluded.email,encrypted_password=excluded.encrypted_password,
        email_confirmed_at=now(),raw_user_meta_data=excluded.raw_user_meta_data,updated_at=now()`,
      [account.id, account.email, password, account.name],
    );
    await tx.unsafe(
      `INSERT INTO auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
       VALUES ($1::text,$2::uuid,jsonb_build_object('sub',($2::uuid)::text,'email',$1::text,'email_verified',true),'email',now(),now(),now())
       ON CONFLICT (provider_id,provider) DO UPDATE SET identity_data=excluded.identity_data,updated_at=now()`,
      [account.email, account.id],
    );
    await tx.unsafe(
      `INSERT INTO users (id,auth_subject,email,name,status,created_at,updated_at)
       VALUES ($1,$1,$2,$3,'active',$4,$4)
       ON CONFLICT (auth_subject) DO UPDATE SET email=excluded.email,name=excluded.name,status='active',updated_at=excluded.updated_at`,
      [account.id, account.email, account.name, now],
    );
    await tx.unsafe(
      `INSERT INTO organizations (id,type,legal_name,display_name,status,created_at,updated_at)
       VALUES ($1,$2,$3,$3,'active',$4,$4)
       ON CONFLICT (id) DO UPDATE SET display_name=excluded.display_name,status='active',updated_at=excluded.updated_at`,
      [account.organizationId, account.type, account.organization, now],
    );
    await tx.unsafe(
      `INSERT INTO organization_members (id,organization_id,user_id,role_id,status,created_at)
       VALUES ($1,$2,$3,$4,'active',$5)
       ON CONFLICT (organization_id,user_id) DO UPDATE SET role_id=excluded.role_id,status='active'`,
      [
        `member:${account.id}`,
        account.organizationId,
        account.id,
        `role:${account.role}`,
        now,
      ],
    );
  }
  await tx.unsafe(
    `INSERT INTO supplier_profiles
     (organization_id,cnpj,legal_name,trade_name,state_registration,responsible_name,responsible_cpf,responsible_email,responsible_phone,reputation_basis_points,onboarding_step,created_at,updated_at)
     VALUES ($1,'12345678000195','Órbita Distribuidora LTDA','Órbita Distribuidora','110.042.490.114','Marina Fornecedora','39053344705','fornecedor@flubox.com.br','11999990001',9720,3,$2,$2)
     ON CONFLICT (organization_id) DO UPDATE SET onboarding_step=3,reputation_basis_points=9720,updated_at=excluded.updated_at`,
    [accounts[1].organizationId, now],
  );
  await tx.unsafe(
    `INSERT INTO reseller_profiles (organization_id,person_type,cpf,full_name,phone,onboarding_step,created_at,updated_at)
     VALUES ($1,'individual','16899535009','Lucas Revendedor','11999990002',3,$2,$2)
     ON CONFLICT (organization_id) DO UPDATE SET onboarding_step=3,updated_at=excluded.updated_at`,
    [accounts[2].organizationId, now],
  );
  await tx.unsafe(
    `INSERT INTO subscriptions (id,organization_id,status,monthly_amount_cents,grace_period_days,provider,current_period_start,current_period_end,created_at,updated_at)
     VALUES ('50000000-0000-4000-8000-000000000001',$1,'active',1990,7,NULL,$2,$3,$2,$2)
     ON CONFLICT (organization_id) DO UPDATE SET status='active',updated_at=excluded.updated_at`,
    [
      accounts[1].organizationId,
      now,
      new Date(Date.now() + 25 * 86400000).toISOString(),
    ],
  );
  await tx.unsafe(
    `INSERT INTO categories (id,name,slug,status,created_at,updated_at)
     VALUES ('30000000-0000-4000-8000-000000000001','Casa e cozinha','casa-e-cozinha','active',$1,$1)
     ON CONFLICT (id) DO NOTHING`,
    [now],
  );
  const products = [
    [
      '40000000-0000-4000-8000-000000000001',
      'ORB-GAR-750',
      'Garrafa térmica Inox 750 ml',
      'Parede dupla, acabamento premium e conservação térmica por até 12 horas.',
      'Órbita',
      8990,
      12990,
      48,
    ],
    [
      '40000000-0000-4000-8000-000000000002',
      'ORB-ORG-06',
      'Kit organizador modular 6 peças',
      'Conjunto empilhável para cozinha, escritório e lavanderia.',
      'Órbita',
      6490,
      9990,
      12,
    ],
    [
      '40000000-0000-4000-8000-000000000003',
      'ORB-LUM-LED',
      'Luminária de mesa LED Touch',
      'Três temperaturas de cor, controle touch e alimentação USB-C.',
      'Lumen',
      11990,
      17990,
      5,
    ],
  ];
  for (const [
    id,
    sku,
    title,
    description,
    brand,
    price,
    retail,
    stock,
  ] of products) {
    await tx.unsafe(
      `INSERT INTO products (id,organization_id,category_id,sku,title,description,short_description,brand,gross_weight_grams,package_height_mm,package_width_mm,package_length_mm,status,quality_score,created_at,updated_at)
       VALUES ($1,$2,'30000000-0000-4000-8000-000000000001',$3,$4,$5,$4,$6,500,200,150,150,'approved',96,$7,$7)
       ON CONFLICT (id) DO UPDATE SET title=excluded.title,short_description=excluded.short_description,gross_weight_grams=excluded.gross_weight_grams,package_height_mm=excluded.package_height_mm,package_width_mm=excluded.package_width_mm,package_length_mm=excluded.package_length_mm,status='approved',updated_at=excluded.updated_at`,
      [id, accounts[1].organizationId, sku, title, description, brand, now],
    );
    await tx.unsafe(
      `INSERT INTO supplier_offers (id,product_id,organization_id,price_cents,suggested_retail_cents,commission_basis_points,preparation_days,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,1000,1,$6,$6)
       ON CONFLICT (product_id) DO UPDATE SET price_cents=excluded.price_cents,suggested_retail_cents=excluded.suggested_retail_cents,updated_at=excluded.updated_at`,
      [`offer:${id}`, id, accounts[1].organizationId, price, retail, now],
    );
    await tx.unsafe(
      `INSERT INTO product_variants (id,product_id,sku,name,attributes_json,price_cents,suggested_retail_cents,stock,status,created_at,updated_at)
       VALUES ($1,$2,$3,'Padrão','{}',$4,$5,$6,'active',$7,$7)
       ON CONFLICT (product_id,sku) DO UPDATE SET id=excluded.id,price_cents=excluded.price_cents,suggested_retail_cents=excluded.suggested_retail_cents,stock=excluded.stock,status='active',updated_at=excluded.updated_at`,
      [
        id.replace('40000000-', '41000000-'),
        id,
        sku,
        price,
        retail,
        stock,
        now,
      ],
    );
    await tx.unsafe(
      `INSERT INTO inventory_movements (id,product_id,organization_id,type,quantity,reference_type,reference_id,created_by,created_at)
       VALUES ($1,$2,$3,'initial',$4,'seed',$2,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [
        `stock:${id}`,
        id,
        accounts[1].organizationId,
        stock,
        accounts[1].id,
        now,
      ],
    );
  }
  const orderId = '60000000-0000-4000-8000-000000000001';
  const orderCreated = new Date(Date.now() - 2 * 86400000).toISOString();
  await tx.unsafe(
    `INSERT INTO orders (id,number,reseller_organization_id,supplier_organization_id,status,channel,external_reference,recipient_snapshot,address_snapshot,subtotal_cents,commission_cents,total_cents,notes,created_by,created_at,updated_at)
     VALUES ($1,'FLB-20260901-0001',$2,$3,'paid_awaiting_documents','mercado_livre','MLB-20260901-01',$4,$5,17980,1798,17980,'Enviar com embalagem reforçada.',$6,$7,$7)
     ON CONFLICT (id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`,
    [
      orderId,
      accounts[2].organizationId,
      accounts[1].organizationId,
      JSON.stringify({ name: 'Camila Souza', document: '***.***.***-**' }),
      JSON.stringify({
        street: 'Rua das Flores',
        number: '128',
        district: 'Centro',
        city: 'Campinas',
        state: 'SP',
        postalCode: '13010-100',
      }),
      accounts[2].id,
      orderCreated,
    ],
  );
  await tx.unsafe(
    `INSERT INTO order_items (id,order_id,product_id,quantity,product_snapshot,unit_price_cents,commission_basis_points,subtotal_cents)
     VALUES ('61000000-0000-4000-8000-000000000001',$1,'40000000-0000-4000-8000-000000000001',2,$2,8990,1000,17980)
     ON CONFLICT (id) DO NOTHING`,
    [
      orderId,
      JSON.stringify({
        title: 'Garrafa térmica Inox 750 ml',
        sku: 'ORB-GAR-750',
        brand: 'Órbita',
      }),
    ],
  );
  await tx.unsafe(
    `INSERT INTO order_events (id,order_id,type,from_status,to_status,actor_user_id,created_at)
     VALUES ('62000000-0000-4000-8000-000000000001',$1,'payment.confirmed','awaiting_payment','paid_awaiting_documents',$2,$3)
     ON CONFLICT (id) DO NOTHING`,
    [
      orderId,
      accounts[2].id,
      new Date(Date.now() - 36 * 3600000).toISOString(),
    ],
  );
  await tx.unsafe(
    `INSERT INTO ledger_entries (id,order_id,organization_id,account,direction,amount_cents,currency,status,reference_type,reference_id,created_at)
     VALUES
      ('63000000-0000-4000-8000-000000000001',$1,$2,'sales_receivable','credit',16182,'BRL','posted','order',$1,$4),
      ('63000000-0000-4000-8000-000000000002',$1,$3,'purchase','debit',17980,'BRL','posted','order',$1,$4)
     ON CONFLICT (id) DO NOTHING`,
    [
      orderId,
      accounts[1].organizationId,
      accounts[2].organizationId,
      orderCreated,
    ],
  );
  await tx.unsafe(
    `INSERT INTO notifications (id,user_id,organization_id,type,title,body,entity_type,entity_id,created_at)
     VALUES ('64000000-0000-4000-8000-000000000001',$1,$2,'order.paid','Pagamento confirmado','Envie a etiqueta e a nota ou declaração para liberar a preparação.','order',$3,$4)
     ON CONFLICT (id) DO NOTHING`,
    [accounts[1].id, accounts[1].organizationId, orderId, now],
  );
  await tx.unsafe(
    `INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
     VALUES ('flubox-files','flubox-files',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
     ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=10485760`,
  );
});

console.log('Contas de teste e bucket privado configurados.');
await sql.end();
