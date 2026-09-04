import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { recordAudit } from '@/modules/audit/service';
import { requireAccountPermission } from '@/modules/identity/service';
import { decryptSecret } from '@/modules/integrations/crypto';
import { getMarketplaceAdapter } from '@/modules/integrations/adapters';
import { calculateListingPrice } from '@/modules/integrations/pricing';
import type { MarketplaceProvider } from '@/modules/integrations/types';
import { z } from 'zod';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const destination = new URL('/integracoes', request.url);
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.redirect(new URL('/entrar', request.url), 303);
    const account = await requireAccountPermission(user, 'integrations.manage');
    const { id } = await context.params;
    const values = Object.fromEntries(await request.formData());
    const parsed = z
      .object({
        action: z.enum(['pause', 'activate', 'unlink', 'link', 'price']),
        productId: z.uuid().optional(),
        pricingMode: z.enum(['margin', 'fixed']).optional(),
        value: z.coerce.number().positive().optional(),
      })
      .parse(values);
    const listing = await getD1()
      .prepare(
        `SELECT l.id,l.cost_snapshot_cents costCents,l.external_listing_id externalListingId,l.published_stock publishedStock,c.provider,c.encrypted_access_token encryptedAccessToken FROM sales_channel_listings l JOIN sales_channel_connections c ON c.id=l.connection_id WHERE l.id=? AND l.organization_id=?`,
      )
      .bind(id, account.organization.id)
      .first<{
        id: string;
        costCents: number | null;
        externalListingId: string | null;
        publishedStock: number;
        provider: MarketplaceProvider;
        encryptedAccessToken: string | null;
      }>();
    if (!listing) throw new Error('LISTING_NOT_FOUND');
    const now = new Date().toISOString();
    if (parsed.action === 'link') {
      if (!parsed.productId) throw new Error('PRODUCT_REQUIRED');
      const product = await getD1()
        .prepare(
          `SELECT p.id,p.sku,o.price_cents costCents FROM products p JOIN supplier_offers o ON o.product_id=p.id WHERE p.id=? AND p.status='approved'`,
        )
        .bind(parsed.productId)
        .first<{ id: string; sku: string; costCents: number }>();
      if (!product) throw new Error('PRODUCT_NOT_AVAILABLE');
      await getD1()
        .prepare(
          `UPDATE sales_channel_listings SET product_id=?,external_sku=?,cost_snapshot_cents=?,status='paused',updated_at=? WHERE id=? AND organization_id=?`,
        )
        .bind(
          product.id,
          product.sku,
          product.costCents,
          now,
          id,
          account.organization.id,
        )
        .run();
    } else if (parsed.action === 'price') {
      if (!listing.costCents || !parsed.pricingMode || parsed.value == null)
        throw new Error('PRICING_RULE_INVALID');
      const rule =
        parsed.pricingMode === 'margin'
          ? {
              mode: 'margin' as const,
              marginBasisPoints: Math.round(parsed.value * 100),
            }
          : {
              mode: 'fixed' as const,
              fixedPriceCents: Math.round(parsed.value * 100),
            };
      const price = calculateListingPrice(listing.costCents, rule);
      if (listing.externalListingId && listing.encryptedAccessToken)
        await getMarketplaceAdapter(listing.provider).updateListing(
          decryptSecret(listing.encryptedAccessToken),
          listing.externalListingId,
          { priceCents: price },
        );
      await getD1()
        .prepare(
          `UPDATE sales_channel_listings SET pricing_mode=?,margin_basis_points=?,fixed_price_cents=?,published_price_cents=?,last_synced_at=?,updated_at=? WHERE id=? AND organization_id=?`,
        )
        .bind(
          rule.mode,
          rule.mode === 'margin' ? rule.marginBasisPoints : null,
          rule.mode === 'fixed' ? rule.fixedPriceCents : null,
          price,
          now,
          now,
          id,
          account.organization.id,
        )
        .run();
    } else {
      const status =
        parsed.action === 'pause'
          ? 'paused'
          : parsed.action === 'activate'
            ? 'active'
            : 'unlinked';
      if (
        parsed.action !== 'unlink' &&
        listing.externalListingId &&
        listing.encryptedAccessToken
      )
        await getMarketplaceAdapter(listing.provider).updateListing(
          decryptSecret(listing.encryptedAccessToken),
          listing.externalListingId,
          {
            status: status as 'active' | 'paused',
            stock: status === 'paused' ? 0 : listing.publishedStock,
          },
        );
      await getD1()
        .prepare(
          "UPDATE sales_channel_listings SET status=?,published_stock=CASE WHEN ?='paused' THEN 0 ELSE published_stock END,last_synced_at=?,updated_at=? WHERE id=? AND organization_id=?",
        )
        .bind(status, status, now, now, id, account.organization.id)
        .run();
    }
    await recordAudit({
      actorUserId: account.user.id,
      organizationId: account.organization.id,
      action: `integration.listing_${parsed.action}`,
      entityType: 'sales_channel_listing',
      entityId: id,
      requestId: requestIdFrom(request),
    });
  } catch (error) {
    destination.searchParams.set(
      'erro',
      error instanceof Error ? error.message : 'Falha no anúncio',
    );
  }
  return Response.redirect(destination, 303);
}
