import { createHmac } from 'node:crypto';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requireAccountPermission } from '@/modules/identity/service';
import { integrationsUseMock } from '@/modules/integrations/adapters';
import { ingestMarketplaceWebhook } from '@/modules/integrations/webhooks';
import type { MarketplaceProvider } from '@/modules/integrations/types';
import { z } from 'zod';

export async function POST(request: Request) {
  const destination = new URL('/integracoes', request.url);
  try {
    if (!integrationsUseMock()) throw new Error('SIMULATION_DISABLED');
    const user = await getAuthenticatedUser();
    if (!user) return Response.redirect(new URL('/entrar', request.url), 303);
    const account = await requireAccountPermission(user, 'integrations.manage');
    const parsed = z
      .object({ listingId: z.uuid() })
      .parse(Object.fromEntries(await request.formData()));
    const listing = await getD1()
      .prepare(
        `SELECT l.external_listing_id externalListingId,c.provider,c.external_account_id externalAccountId FROM sales_channel_listings l JOIN sales_channel_connections c ON c.id=l.connection_id WHERE l.id=? AND l.organization_id=? AND l.product_id IS NOT NULL AND l.status='active'`,
      )
      .bind(parsed.listingId, account.organization.id)
      .first<{
        externalListingId: string;
        externalAccountId: string;
        provider: MarketplaceProvider;
      }>();
    if (!listing) throw new Error('ACTIVE_LISTING_REQUIRED');
    const payload = JSON.stringify({
      eventId: crypto.randomUUID(),
      type: 'order',
      accountId: listing.externalAccountId,
      orderId: `demo-${crypto.randomUUID()}`,
      listingId: listing.externalListingId,
      quantity: 1,
      recipient: {
        name: 'Cliente Demonstração',
        document: '123.456.789-00',
        phone: '(11) 99999-0000',
      },
      address: {
        postalCode: '01001-000',
        street: 'Praça da Sé',
        number: '100',
        district: 'Sé',
        city: 'São Paulo',
        state: 'SP',
      },
    });
    const signature = createHmac(
      'sha256',
      process.env.INTEGRATIONS_WEBHOOK_SECRET ?? 'flubox-local-webhook',
    )
      .update(payload)
      .digest('hex');
    await ingestMarketplaceWebhook({
      provider: listing.provider,
      rawBody: payload,
      signature,
    });
    return Response.redirect(new URL('/pedidos', request.url), 303);
  } catch (error) {
    destination.searchParams.set(
      'erro',
      error instanceof Error ? error.message : 'Falha na simulação',
    );
    return Response.redirect(destination, 303);
  }
}
