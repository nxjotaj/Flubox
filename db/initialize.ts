import { getD1 } from './index';
import {
  PERMISSIONS,
  ROLE_PERMISSION_MAP,
  type RoleKey,
} from '@/modules/identity/permissions';

const _schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, auth_subject TEXT NOT NULL UNIQUE, email TEXT NOT NULL, name TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, legal_name TEXT NOT NULL, display_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'onboarding', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_organizations_type_status ON organizations(type, status)`,
  `CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY NOT NULL, key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, scope TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY NOT NULL, key TEXT NOT NULL UNIQUE, description TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, PRIMARY KEY(role_id, permission_id))`,
  `CREATE TABLE IF NOT EXISTS organization_members (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id TEXT NOT NULL REFERENCES roles(id), status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_members_org_user ON organization_members(organization_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_members_user_status ON organization_members(user_id, status)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY NOT NULL, actor_user_id TEXT REFERENCES users(id), organization_id TEXT REFERENCES organizations(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, request_id TEXT NOT NULL, reason TEXT, metadata TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_logs(organization_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`,
  `CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_by TEXT REFERENCES users(id), updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS supplier_profiles (organization_id TEXT PRIMARY KEY NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, cnpj TEXT NOT NULL UNIQUE, legal_name TEXT NOT NULL, trade_name TEXT NOT NULL, state_registration TEXT, responsible_name TEXT NOT NULL, responsible_cpf TEXT NOT NULL, responsible_email TEXT NOT NULL, responsible_phone TEXT NOT NULL, reputation_basis_points INTEGER NOT NULL DEFAULT 10000, onboarding_step INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reseller_profiles (organization_id TEXT PRIMARY KEY NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, person_type TEXT NOT NULL DEFAULT 'individual', cpf TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, phone TEXT NOT NULL, onboarding_step INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, type TEXT NOT NULL DEFAULT 'primary', postal_code TEXT NOT NULL, street TEXT NOT NULL, number TEXT NOT NULL, complement TEXT, district TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, country TEXT NOT NULL DEFAULT 'BR', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_org_type ON addresses(organization_id, type)`,
  `CREATE TABLE IF NOT EXISTS verifications (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, field TEXT NOT NULL, value_hash TEXT, status TEXT NOT NULL DEFAULT 'pending', source TEXT NOT NULL, checked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_verifications_org_field ON verifications(organization_id, field)`,
  `CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, type TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', expires_at TEXT, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_documents_org_status ON documents(organization_id, status)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending', monthly_amount_cents INTEGER NOT NULL, grace_period_days INTEGER NOT NULL, provider TEXT, external_reference TEXT, current_period_start TEXT, current_period_end TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS organization_invitations (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, email TEXT NOT NULL, role_id TEXT NOT NULL REFERENCES roles(id), status TEXT NOT NULL DEFAULT 'pending', token_hash TEXT UNIQUE, invited_by TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL, accepted_by TEXT REFERENCES users(id), accepted_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_org_email ON organization_invitations(organization_id, email)`,
  `CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, parent_id TEXT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS category_attributes (id TEXT PRIMARY KEY NOT NULL, category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE, key TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL, required INTEGER NOT NULL DEFAULT 0, options_json TEXT, unit TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_category_attribute_key ON category_attributes(category_id, key)`,
  `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, category_id TEXT REFERENCES categories(id), sku TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, brand TEXT, gtin TEXT, ncm TEXT, status TEXT NOT NULL DEFAULT 'draft', quality_score INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_sku ON products(organization_id, sku)`,
  `CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category_id)`,
  `CREATE TABLE IF NOT EXISTS supplier_offers (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, price_cents INTEGER NOT NULL, suggested_retail_cents INTEGER, commission_basis_points INTEGER NOT NULL, preparation_days INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS product_attribute_values (product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, attribute_id TEXT NOT NULL REFERENCES category_attributes(id) ON DELETE CASCADE, value TEXT NOT NULL, PRIMARY KEY(product_id, attribute_id))`,
  `CREATE TABLE IF NOT EXISTS product_price_history (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, price_cents INTEGER NOT NULL, commission_basis_points INTEGER NOT NULL, effective_at TEXT NOT NULL, changed_by TEXT NOT NULL REFERENCES users(id))`,
  `CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON product_price_history(product_id, effective_at)`,
  `CREATE TABLE IF NOT EXISTS inventory_movements (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL REFERENCES products(id), organization_id TEXT NOT NULL REFERENCES organizations(id), type TEXT NOT NULL, quantity INTEGER NOT NULL, reference_type TEXT NOT NULL, reference_id TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_product_created ON inventory_movements(product_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS product_media (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, storage_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, alt_text TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_product_media_product_sort ON product_media(product_id, sort_order)`,
  `CREATE TABLE IF NOT EXISTS import_jobs (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id), file_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'processing', total_rows INTEGER NOT NULL DEFAULT 0, imported_rows INTEGER NOT NULL DEFAULT 0, pending_rows INTEGER NOT NULL DEFAULT 0, rejected_rows INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, completed_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_import_jobs_org_created ON import_jobs(organization_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS import_errors (id TEXT PRIMARY KEY NOT NULL, job_id TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE, row_number INTEGER NOT NULL, column_name TEXT NOT NULL, received_value TEXT, error TEXT NOT NULL, recommendation TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_import_errors_job_row ON import_errors(job_id, row_number)`,
  `CREATE TABLE IF NOT EXISTS product_favorites (organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, PRIMARY KEY(organization_id, product_id))`,
  `CREATE TABLE IF NOT EXISTS product_lists (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_product_lists_org_name ON product_lists(organization_id, name)`,
  `CREATE TABLE IF NOT EXISTS product_list_items (list_id TEXT NOT NULL REFERENCES product_lists(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(list_id, product_id))`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY NOT NULL, number TEXT NOT NULL UNIQUE, reseller_organization_id TEXT NOT NULL REFERENCES organizations(id), supplier_organization_id TEXT NOT NULL REFERENCES organizations(id), status TEXT NOT NULL, channel TEXT NOT NULL, external_reference TEXT, recipient_snapshot TEXT NOT NULL, address_snapshot TEXT NOT NULL, subtotal_cents INTEGER NOT NULL, commission_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL, notes TEXT, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_reseller_created ON orders(reseller_organization_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_supplier_status ON orders(supplier_organization_id, status)`,
  `CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, product_snapshot TEXT NOT NULL, unit_price_cents INTEGER NOT NULL, commission_basis_points INTEGER NOT NULL, subtotal_cents INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS inventory_reservations (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', expires_at TEXT NOT NULL, created_at TEXT NOT NULL, released_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_reservations_product_status ON inventory_reservations(product_id, status)`,
  `CREATE TABLE IF NOT EXISTS order_events (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, type TEXT NOT NULL, from_status TEXT, to_status TEXT, actor_user_id TEXT REFERENCES users(id), metadata TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_order_events_order_created ON order_events(order_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS payment_intents (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), provider TEXT NOT NULL, external_id TEXT UNIQUE, status TEXT NOT NULL, amount_cents INTEGER NOT NULL, pix_copy_paste TEXT, qr_storage_key TEXT, expires_at TEXT, paid_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ledger_entries (id TEXT PRIMARY KEY NOT NULL, order_id TEXT REFERENCES orders(id), organization_id TEXT NOT NULL REFERENCES organizations(id), account TEXT NOT NULL, direction TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'BRL', status TEXT NOT NULL DEFAULT 'posted', reference_type TEXT NOT NULL, reference_id TEXT NOT NULL, external_reference TEXT, metadata TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_ledger_org_created ON ledger_entries(organization_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS order_documents (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, type TEXT NOT NULL, number TEXT, issuer TEXT NOT NULL, issued_at TEXT, storage_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_order_documents_order ON order_documents(order_id)`,
  `CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY NOT NULL, provider TEXT NOT NULL, external_event_id TEXT NOT NULL, signature_valid INTEGER NOT NULL, status TEXT NOT NULL, payload_hash TEXT NOT NULL, error TEXT, received_at TEXT NOT NULL, processed_at TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_provider_event ON webhook_events(provider, external_event_id)`,
  `CREATE TABLE IF NOT EXISTS shipments (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE, carrier TEXT NOT NULL, tracking_code TEXT, status TEXT NOT NULL DEFAULT 'preparing', preparation_deadline TEXT NOT NULL, shipped_at TEXT, delivered_at TEXT, proof_storage_key TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_shipments_status_deadline ON shipments(status, preparation_deadline)`,
  `CREATE TABLE IF NOT EXISTS tracking_events (id TEXT PRIMARY KEY NOT NULL, shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE, external_id TEXT, status TEXT NOT NULL, description TEXT NOT NULL, location TEXT, source TEXT NOT NULL, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_tracking_shipment_occurred ON tracking_events(shipment_id, occurred_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_shipment_external ON tracking_events(shipment_id, external_id)`,
  `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, entity_type TEXT, entity_id TEXT, read_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at, created_at)`,
  `CREATE TABLE IF NOT EXISTS payouts (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id), status TEXT NOT NULL DEFAULT 'pending', gross_cents INTEGER NOT NULL, fee_cents INTEGER NOT NULL DEFAULT 0, net_cents INTEGER NOT NULL, provider TEXT, external_reference TEXT, scheduled_at TEXT, paid_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_payouts_org_status ON payouts(organization_id, status)`,
  `CREATE TABLE IF NOT EXISTS reconciliation_runs (id TEXT PRIMARY KEY NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, expected_cents INTEGER NOT NULL, observed_cents INTEGER NOT NULL, difference_cents INTEGER NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, completed_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_reconciliation_period ON reconciliation_runs(period_start, period_end)`,
  `CREATE TABLE IF NOT EXISTS subscription_events (id TEXT PRIMARY KEY NOT NULL, subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE, type TEXT NOT NULL, amount_cents INTEGER, external_reference TEXT, reason TEXT, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription ON subscription_events(subscription_id, occurred_at)`,
  `CREATE TABLE IF NOT EXISTS support_cases (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), opened_by_organization_id TEXT NOT NULL REFERENCES organizations(id), type TEXT NOT NULL, reason TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', resolution TEXT, mediation_requested_at TEXT, resolved_at TEXT, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_support_cases_order_status ON support_cases(order_id, status)`,
  `CREATE TABLE IF NOT EXISTS case_messages (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE, author_user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_case_messages_case_created ON case_messages(case_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS case_evidence (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE, storage_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, uploaded_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_case_evidence_case ON case_evidence(case_id)`,
  `CREATE TABLE IF NOT EXISTS refunds (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES support_cases(id), order_id TEXT NOT NULL REFERENCES orders(id), amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'approved', provider TEXT, external_reference TEXT, approved_by TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_refunds_order_status ON refunds(order_id, status)`,
  `CREATE TABLE IF NOT EXISTS relationship_credits (id TEXT PRIMARY KEY NOT NULL, reseller_organization_id TEXT NOT NULL REFERENCES organizations(id), supplier_organization_id TEXT NOT NULL REFERENCES organizations(id), order_id TEXT NOT NULL REFERENCES orders(id), refund_id TEXT NOT NULL REFERENCES refunds(id), original_cents INTEGER NOT NULL, remaining_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'available', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_credits_relationship_status ON relationship_credits(reseller_organization_id, supplier_organization_id, status)`,
  `CREATE TABLE IF NOT EXISTS reputation_snapshots (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, score_basis_points INTEGER NOT NULL, components_json TEXT NOT NULL, weights_json TEXT NOT NULL, source_window_start TEXT NOT NULL, source_window_end TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_reputation_org_created ON reputation_snapshots(organization_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY NOT NULL, organization_id TEXT REFERENCES organizations(id), user_id TEXT REFERENCES users(id), type TEXT NOT NULL, entity_type TEXT, entity_id TEXT, properties_json TEXT, occurred_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_type_occurred ON analytics_events(type, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_org_occurred ON analytics_events(organization_id, occurred_at)`,
  `CREATE TABLE IF NOT EXISTS risk_assessments (id TEXT PRIMARY KEY NOT NULL, order_id TEXT REFERENCES orders(id), organization_id TEXT NOT NULL REFERENCES organizations(id), score INTEGER NOT NULL, decision TEXT NOT NULL, signals_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_risk_org_created ON risk_assessments(organization_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS data_subject_requests (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), organization_id TEXT REFERENCES organizations(id), type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reason TEXT, requested_at TEXT NOT NULL, completed_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_data_requests_user_status ON data_subject_requests(user_id, status)`,
  `CREATE TABLE IF NOT EXISTS rate_limit_buckets (key TEXT NOT NULL, window_start TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(key, window_start))`,
];

const roleNames: Record<RoleKey, string> = {
  supplier_owner: 'Proprietário fornecedor',
  supplier_member: 'Colaborador fornecedor',
  supplier_operator_1: 'Operador de expedição 1',
  supplier_operator_2: 'Operador de expedição 2',
  reseller_owner: 'Proprietário revendedor',
  reseller_member: 'Colaborador revendedor',
  platform_admin: 'Administrador da plataforma',
};

let initialized: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  initialized ??= initializeDatabase().catch((error) => {
    initialized = null;
    throw error;
  });
  return initialized;
}

async function initializeDatabase(): Promise<void> {
  const d1 = getD1();

  const now = new Date().toISOString();
  const permissionEntries = Object.entries(PERMISSIONS);
  await d1.batch(
    permissionEntries.map(([key, description]) =>
      d1
        .prepare(
          `INSERT OR IGNORE INTO permissions (id, key, description, created_at) VALUES (?, ?, ?, ?)`,
        )
        .bind(`permission:${key}`, key, description, now),
    ),
  );

  const roleEntries = Object.entries(roleNames) as [RoleKey, string][];
  await d1.batch(
    roleEntries.map(([key, name]) =>
      d1
        .prepare(
          `INSERT OR IGNORE INTO roles (id, key, name, scope, created_at) VALUES (?, ?, ?, 'organization', ?)`,
        )
        .bind(`role:${key}`, key, name, now),
    ),
  );

  const grants = roleEntries.flatMap(([role]) =>
    ROLE_PERMISSION_MAP[role].map((permission) =>
      d1
        .prepare(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        )
        .bind(`role:${role}`, `permission:${permission}`),
    ),
  );
  await d1.batch(grants);
  await d1.prepare('PRAGMA optimize').run();
}
