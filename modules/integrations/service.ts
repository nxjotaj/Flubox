import 'server-only';
import { getD1 } from '@/db';
import type { AccountContext } from '@/modules/identity/service';
import { recordAudit } from '@/modules/audit/service';
import { decryptSecret, encryptSecret, hashIntegrationValue } from './crypto';
import {
  getMarketplaceAdapter,
  integrationsUseMock,
  isProviderEnabled,
} from './adapters';
import { calculateListingPrice, calculatePublishableStock } from './pricing';
import type { MarketplaceProvider, PricingRule } from './types';

const providerLabel: Record<MarketplaceProvider, string> = {
  mercado_livre: 'Mercado Livre',
  shopee: 'Shopee',
};

export function isMarketplaceProvider(
  value: string,
): value is MarketplaceProvider {
  return value === 'mercado_livre' || value === 'shopee';
}

export async function beginAuthorization(input: {
  account: AccountContext;
  provider: MarketplaceProvider;
  redirectUri: string;
  requestId: string;
}) {
  if (!isProviderEnabled(input.provider)) throw new Error('PROVIDER_DISABLED');
  const state = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date();
  await getD1()
    .prepare(
      `INSERT INTO sales_channel_oauth_states (id,organization_id,user_id,provider,state_hash,return_path,expires_at,created_at) VALUES (?,?,?,?,?,'/integracoes',?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.account.organization.id,
      input.account.user.id,
      input.provider,
      hashIntegrationValue(state),
      new Date(now.getTime() + 10 * 60_000).toISOString(),
      now.toISOString(),
    )
    .run();
  await recordAudit({
    actorUserId: input.account.user.id,
    organizationId: input.account.organization.id,
    action: 'integration.authorization_started',
    entityType: 'sales_channel_connection',
    entityId: input.provider,
    requestId: input.requestId,
  });
  return getMarketplaceAdapter(input.provider).authorizationUrl(
    state,
    input.redirectUri,
  );
}

export async function completeAuthorization(input: {
  provider: MarketplaceProvider;
  state: string;
  code: string;
  shopId?: string;
  redirectUri: string;
}) {
  const stateHash = hashIntegrationValue(input.state);
  const oauth = await getD1()
    .prepare(
      `SELECT id,organization_id organizationId,user_id userId,expires_at expiresAt,consumed_at consumedAt FROM sales_channel_oauth_states WHERE provider=? AND state_hash=?`,
    )
    .bind(input.provider, stateHash)
    .first<{
      id: string;
      organizationId: string;
      userId: string;
      expiresAt: string;
      consumedAt: string | null;
    }>();
  if (
    !oauth ||
    oauth.consumedAt ||
    new Date(oauth.expiresAt).getTime() < Date.now()
  )
    throw new Error('OAUTH_STATE_INVALID');
  const adapter = getMarketplaceAdapter(input.provider);
  const tokens = await adapter.exchangeCode(
    input.provider === 'shopee'
      ? `${input.code}:${input.shopId ?? ''}`
      : input.code,
    input.redirectUri,
  );
  const now = new Date().toISOString();
  const existing = await getD1()
    .prepare(
      'SELECT id,organization_id organizationId FROM sales_channel_connections WHERE provider=? AND external_account_id=?',
    )
    .bind(input.provider, tokens.externalAccountId)
    .first<{ id: string; organizationId: string }>();
  if (existing && existing.organizationId !== oauth.organizationId)
    throw new Error('EXTERNAL_ACCOUNT_ALREADY_CONNECTED');
  const connectionId = existing?.id ?? crypto.randomUUID();
  await getD1().batch([
    getD1()
      .prepare(
        'UPDATE sales_channel_oauth_states SET consumed_at=? WHERE id=? AND consumed_at IS NULL',
      )
      .bind(now, oauth.id),
    getD1()
      .prepare(
        `INSERT INTO sales_channel_connections (id,organization_id,provider,external_account_id,display_name,status,encrypted_access_token,encrypted_refresh_token,token_expires_at,scopes_json,settings_json,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?,?,?, '{}',?,?,?) ON CONFLICT (provider,external_account_id) DO UPDATE SET display_name=excluded.display_name,status='active',encrypted_access_token=excluded.encrypted_access_token,encrypted_refresh_token=excluded.encrypted_refresh_token,token_expires_at=excluded.token_expires_at,scopes_json=excluded.scopes_json,last_error=NULL,updated_at=excluded.updated_at`,
      )
      .bind(
        connectionId,
        oauth.organizationId,
        input.provider,
        tokens.externalAccountId,
        tokens.displayName,
        encryptSecret(tokens.accessToken),
        tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        tokens.expiresAt ?? null,
        JSON.stringify(tokens.scopes),
        oauth.userId,
        now,
        now,
      ),
  ]);
  await recordAudit({
    actorUserId: oauth.userId,
    organizationId: oauth.organizationId,
    action: 'integration.connected',
    entityType: 'sales_channel_connection',
    entityId: connectionId,
    requestId: crypto.randomUUID(),
    metadata: { provider: input.provider, simulated: integrationsUseMock() },
  });
  return connectionId;
}

type ProductForListing = {
  id: string;
  title: string;
  description: string;
  sku: string;
  gtin: string | null;
  categoryId: string | null;
  costCents: number;
  stock: number;
  reserved: number;
  attributesJson: string | null;
};

export async function publishProduct(input: {
  account: AccountContext;
  connectionId: string;
  productId: string;
  variantId?: string;
  rule: PricingRule;
  safetyStock: number;
  requestId: string;
}) {
  const connection = await getD1()
    .prepare(
      `SELECT id,provider,status,encrypted_access_token encryptedAccessToken FROM sales_channel_connections WHERE id=? AND organization_id=?`,
    )
    .bind(input.connectionId, input.account.organization.id)
    .first<{
      id: string;
      provider: MarketplaceProvider;
      status: string;
      encryptedAccessToken: string | null;
    }>();
  if (
    !connection ||
    connection.status !== 'active' ||
    !connection.encryptedAccessToken
  )
    throw new Error('CONNECTION_NOT_ACTIVE');
  const product = await getD1()
    .prepare(
      `SELECT p.id,p.title,p.description,COALESCE(v.sku,p.sku) sku,COALESCE(v.gtin,p.gtin) gtin,p.category_id categoryId,COALESCE(v.price_cents,o.price_cents) costCents,CASE WHEN v.id IS NULL THEN COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id=p.id),0) ELSE v.stock END stock,COALESCE((SELECT SUM(quantity) FROM inventory_reservations WHERE product_id=p.id AND variant_id IS NOT DISTINCT FROM ? AND status='active' AND expires_at>?),0) reserved,v.attributes_json attributesJson FROM products p JOIN supplier_offers o ON o.product_id=p.id LEFT JOIN product_variants v ON v.id=? AND v.product_id=p.id WHERE p.id=? AND p.status='approved'`,
    )
    .bind(
      input.variantId ?? null,
      new Date().toISOString(),
      input.variantId ?? null,
      input.productId,
    )
    .first<ProductForListing>();
  if (!product) throw new Error('PRODUCT_NOT_AVAILABLE');
  const mapping = product.categoryId
    ? await getD1()
        .prepare(
          'SELECT external_category_id externalCategoryId,attributes_json attributesJson FROM sales_channel_category_mappings WHERE provider=? AND category_id=?',
        )
        .bind(connection.provider, product.categoryId)
        .first<{ externalCategoryId: string; attributesJson: string }>()
    : null;
  if (!mapping && !integrationsUseMock())
    throw new Error('CATEGORY_MAPPING_REQUIRED');
  const priceCents = calculateListingPrice(product.costCents, input.rule);
  const stock = calculatePublishableStock(
    product.stock,
    product.reserved,
    input.safetyStock,
  );
  const adapter = getMarketplaceAdapter(connection.provider);
  const published = await adapter.publishListing(
    decryptSecret(connection.encryptedAccessToken),
    {
      sku: product.sku,
      title: product.title,
      description: product.description,
      categoryId:
        mapping?.externalCategoryId ??
        `demo-${product.categoryId ?? 'general'}`,
      priceCents,
      stock,
      imageUrls: [],
      attributes: {
        ...(product.attributesJson ? JSON.parse(product.attributesJson) : {}),
        ...(mapping ? JSON.parse(mapping.attributesJson) : {}),
      },
    },
  );
  const now = new Date().toISOString();
  const listingId = crypto.randomUUID();
  await getD1()
    .prepare(
      `INSERT INTO sales_channel_listings (id,connection_id,organization_id,product_id,variant_id,external_listing_id,external_variant_id,external_url,external_category_id,external_sku,status,pricing_mode,margin_basis_points,fixed_price_cents,cost_snapshot_cents,published_price_cents,published_stock,safety_stock,validation_json,last_synced_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, '[]',?,?,?)`,
    )
    .bind(
      listingId,
      connection.id,
      input.account.organization.id,
      product.id,
      input.variantId ?? null,
      published.externalListingId,
      published.externalVariantId ?? null,
      published.url ?? null,
      mapping?.externalCategoryId ?? null,
      product.sku,
      published.status,
      input.rule.mode,
      input.rule.mode === 'margin' ? input.rule.marginBasisPoints : null,
      input.rule.mode === 'fixed' ? input.rule.fixedPriceCents : null,
      product.costCents,
      priceCents,
      stock,
      input.safetyStock,
      now,
      now,
      now,
    )
    .run();
  await recordAudit({
    actorUserId: input.account.user.id,
    organizationId: input.account.organization.id,
    action: 'integration.listing_published',
    entityType: 'sales_channel_listing',
    entityId: listingId,
    requestId: input.requestId,
    metadata: {
      provider: connection.provider,
      externalListingId: published.externalListingId,
    },
  });
  return listingId;
}

export async function reconcileConnection(input: {
  account: AccountContext;
  connectionId: string;
  requestId: string;
}) {
  const connection = await getD1()
    .prepare(
      "SELECT id,provider,encrypted_access_token encryptedAccessToken FROM sales_channel_connections WHERE id=? AND organization_id=? AND status='active'",
    )
    .bind(input.connectionId, input.account.organization.id)
    .first<{
      id: string;
      provider: MarketplaceProvider;
      encryptedAccessToken: string;
    }>();
  if (!connection) throw new Error('CONNECTION_NOT_ACTIVE');
  const runId = crypto.randomUUID();
  const started = new Date().toISOString();
  await getD1()
    .prepare(
      `INSERT INTO sales_channel_sync_runs (id,connection_id,kind,status,started_at) VALUES (?,?,'reconciliation','running',?)`,
    )
    .bind(runId, connection.id, started)
    .run();
  try {
    const external = await getMarketplaceAdapter(
      connection.provider,
    ).listListings(decryptSecret(connection.encryptedAccessToken));
    const now = new Date().toISOString();
    for (const listing of external)
      await getD1()
        .prepare(
          `INSERT INTO sales_channel_listings (id,connection_id,organization_id,external_listing_id,external_variant_id,external_url,external_sku,status,pricing_mode,published_price_cents,published_stock,validation_json,last_synced_at,created_at,updated_at) VALUES (?,?,?, ?,?,?,?,?,'margin',?,?,'[]',?,?,?) ON CONFLICT (connection_id,external_listing_id,external_variant_id) DO UPDATE SET external_url=excluded.external_url,external_sku=excluded.external_sku,status=excluded.status,published_price_cents=excluded.published_price_cents,published_stock=excluded.published_stock,last_synced_at=excluded.last_synced_at,updated_at=excluded.updated_at`,
        )
        .bind(
          crypto.randomUUID(),
          connection.id,
          input.account.organization.id,
          listing.externalListingId,
          listing.externalVariantId ?? '',
          listing.url ?? null,
          listing.externalSku ?? null,
          listing.status,
          listing.priceCents,
          listing.stock,
          now,
          now,
          now,
        )
        .run();
    await getD1().batch([
      getD1()
        .prepare(
          `UPDATE sales_channel_sync_runs SET status='completed',attempted=?,succeeded=?,completed_at=? WHERE id=?`,
        )
        .bind(external.length, external.length, now, runId),
      getD1()
        .prepare(
          'UPDATE sales_channel_connections SET last_synced_at=?,last_error=NULL,updated_at=? WHERE id=?',
        )
        .bind(now, now, connection.id),
    ]);
    return external.length;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha desconhecida';
    const now = new Date().toISOString();
    await getD1().batch([
      getD1()
        .prepare(
          `UPDATE sales_channel_sync_runs SET status='failed',failed=1,error=?,completed_at=? WHERE id=?`,
        )
        .bind(message, now, runId),
      getD1()
        .prepare(
          `UPDATE sales_channel_connections SET status='error',last_error=?,updated_at=? WHERE id=?`,
        )
        .bind(message, now, connection.id),
    ]);
    throw error;
  }
}

export async function syncProductListings(productId: string) {
  const rows = await getD1()
    .prepare(
      `SELECT l.id,l.variant_id variantId,l.external_listing_id externalListingId,l.pricing_mode pricingMode,l.margin_basis_points marginBasisPoints,l.fixed_price_cents fixedPriceCents,l.safety_stock safetyStock,c.provider,c.encrypted_access_token encryptedAccessToken,COALESCE(v.price_cents,o.price_cents) costCents,CASE WHEN v.id IS NULL THEN COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id=p.id),0) ELSE v.stock END physicalStock,COALESCE((SELECT SUM(quantity) FROM inventory_reservations WHERE product_id=p.id AND variant_id IS NOT DISTINCT FROM l.variant_id AND status='active' AND expires_at>?),0) reservedStock FROM sales_channel_listings l JOIN sales_channel_connections c ON c.id=l.connection_id AND c.status='active' JOIN products p ON p.id=l.product_id JOIN supplier_offers o ON o.product_id=p.id LEFT JOIN product_variants v ON v.id=l.variant_id WHERE l.product_id=? AND l.status IN ('active','paused') ORDER BY l.id FOR UPDATE OF l`,
    )
    .bind(new Date().toISOString(), productId)
    .all<{
      id: string;
      variantId: string | null;
      externalListingId: string | null;
      pricingMode: string;
      marginBasisPoints: number | null;
      fixedPriceCents: number | null;
      safetyStock: number;
      provider: MarketplaceProvider;
      encryptedAccessToken: string | null;
      costCents: number;
      physicalStock: number;
      reservedStock: number;
    }>();
  for (const row of rows.results) {
    if (!row.externalListingId || !row.encryptedAccessToken) continue;
    const rule: PricingRule =
      row.pricingMode === 'fixed'
        ? {
            mode: 'fixed',
            fixedPriceCents: row.fixedPriceCents ?? row.costCents,
          }
        : { mode: 'margin', marginBasisPoints: row.marginBasisPoints ?? 0 };
    const price = calculateListingPrice(row.costCents, rule);
    const stock = calculatePublishableStock(
      row.physicalStock,
      row.reservedStock,
      row.safetyStock,
    );
    const status = stock > 0 ? ('active' as const) : ('paused' as const);
    const now = new Date().toISOString();
    try {
      await getMarketplaceAdapter(row.provider).updateListing(
        decryptSecret(row.encryptedAccessToken),
        row.externalListingId,
        { priceCents: price, stock, status },
      );
      await getD1()
        .prepare(
          `UPDATE sales_channel_listings SET status=?,cost_snapshot_cents=?,published_price_cents=?,published_stock=?,last_error=NULL,last_synced_at=?,updated_at=? WHERE id=?`,
        )
        .bind(status, row.costCents, price, stock, now, now, row.id)
        .run();
    } catch (error) {
      await getD1()
        .prepare(
          `UPDATE sales_channel_listings SET status='error',last_error=?,updated_at=? WHERE id=?`,
        )
        .bind(
          error instanceof Error ? error.message : 'Falha na sincronização',
          now,
          row.id,
        )
        .run();
    }
  }
}

export { providerLabel };
