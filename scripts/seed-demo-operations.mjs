import postgres from 'postgres';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ausente');
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  prepare: false,
});
const now = new Date().toISOString();
const [admin] =
  await sql`SELECT id FROM users WHERE email='admin@flubox.com.br'`;
const [reseller] =
  await sql`SELECT id FROM users WHERE email='revendedor@flubox.com.br'`;
const [order] =
  await sql`SELECT id,reseller_organization_id FROM orders ORDER BY created_at LIMIT 1`;
const settings = {
  commission_basis_points: '1000',
  supplier_monthly_fee_cents: '1990',
  subscription_grace_days: '7',
  pix_expiration_minutes: '30',
  dispute_window_days: '7',
  max_upload_megabytes: '10',
};
for (const [key, value] of Object.entries(settings))
  await sql`INSERT INTO system_settings (key,value,version,updated_by,updated_at) VALUES (${key},${value},1,${admin.id},${now}) ON CONFLICT(key) DO NOTHING`;
await sql`INSERT INTO support_cases (id,order_id,opened_by_organization_id,type,reason,description,status,created_by,created_at,updated_at) VALUES ('70000000-0000-4000-8000-000000000001',${order.id},${order.reseller_organization_id},'dispute','Produto divergente','O revendedor informou divergência entre o item anunciado e o recebido pelo consumidor final.','open',${reseller.id},${now},${now}) ON CONFLICT(id) DO NOTHING`;
await sql`INSERT INTO case_messages (id,case_id,author_user_id,body,created_at) VALUES ('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',${reseller.id},'Solicito análise da divergência e orientação para o atendimento.',${now}) ON CONFLICT(id) DO NOTHING`;
const [platform] =
  await sql`SELECT id FROM organizations WHERE type='platform' LIMIT 1`;
const events = [
  [
    '72000000-0000-4000-8000-000000000001',
    'platform.seeded',
    'platform',
    platform.id,
  ],
  [
    '72000000-0000-4000-8000-000000000002',
    'order.payment_confirmed',
    'order',
    order.id,
  ],
  [
    '72000000-0000-4000-8000-000000000003',
    'case.opened',
    'support_case',
    '70000000-0000-4000-8000-000000000001',
  ],
];
for (const [id, action, type, entity] of events)
  await sql`INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (${id},${admin.id},${platform.id},${action},${type},${entity},${`seed-${id}`},${JSON.stringify({ developmentDemo: true })},${now}) ON CONFLICT(id) DO NOTHING`;
console.log('Cenários operacionais de demonstração preparados.');
await sql.end();
