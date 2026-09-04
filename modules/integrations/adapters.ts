import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  MarketplaceAdapter,
  MarketplaceEvent,
  MarketplaceListing,
  MarketplaceProvider,
  MarketplaceTokens,
  PublishListingInput,
} from './types';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

function verifyHmac(
  rawBody: string,
  signature: string | null,
  secret?: string,
) {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signature.replace(/^sha256=/, '');
  return (
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
}

function scalar(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
}

class MockAdapter implements MarketplaceAdapter {
  constructor(
    readonly provider: MarketplaceProvider,
    private readonly simulated = true,
  ) {}
  private assertSimulated() {
    if (!this.simulated)
      throw new Error(
        `${this.provider.toUpperCase()}_LIVE_OPERATION_NOT_IMPLEMENTED`,
      );
  }
  authorizationUrl(state: string, redirectUri: string) {
    const url = new URL(redirectUri);
    url.searchParams.set('code', `mock-${this.provider}`);
    url.searchParams.set('state', state);
    return url.toString();
  }
  async exchangeCode(
    _code?: string,
    _redirectUri?: string,
  ): Promise<MarketplaceTokens> {
    return {
      accessToken: `mock-access-${crypto.randomUUID()}`,
      refreshToken: `mock-refresh-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      externalAccountId: `mock-${this.provider}`,
      displayName:
        this.provider === 'mercado_livre'
          ? 'Loja Mercado Livre Demo'
          : 'Loja Shopee Demo',
      scopes: ['listings', 'orders', 'inventory'],
    };
  }
  async refreshToken(): Promise<MarketplaceTokens> {
    return this.exchangeCode();
  }
  async listListings(): Promise<MarketplaceListing[]> {
    this.assertSimulated();
    return [
      {
        externalListingId: `imported-${this.provider}`,
        externalSku: `EXISTENTE-${this.provider === 'mercado_livre' ? 'ML' : 'SHP'}`,
        title: 'Anúncio existente para vincular',
        priceCents: 12990,
        stock: 3,
        status: 'unlinked',
        url: `https://example.invalid/${this.provider}/imported`,
      },
    ];
  }
  async publishListing(
    _token: string,
    input: PublishListingInput,
  ): Promise<MarketplaceListing> {
    this.assertSimulated();
    const id = `${this.provider === 'mercado_livre' ? 'MLB' : 'SHP'}-${crypto.randomUUID().slice(0, 8)}`;
    return {
      externalListingId: id,
      externalSku: input.sku,
      title: input.title,
      priceCents: input.priceCents,
      stock: input.stock,
      status: input.stock > 0 ? 'active' : 'paused',
      url: `https://example.invalid/${this.provider}/${id}`,
    };
  }
  async updateListing() {
    this.assertSimulated();
  }
  verifyWebhook(rawBody: string, signature: string | null) {
    return verifyHmac(
      rawBody,
      signature,
      process.env.INTEGRATIONS_WEBHOOK_SECRET ?? 'flubox-local-webhook',
    );
  }
  normalizeWebhook(rawBody: string): MarketplaceEvent {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      externalEventId:
        scalar(payload.eventId) || scalar(payload.id) || crypto.randomUUID(),
      connectionExternalId: scalar(payload.accountId) || undefined,
      type: scalar(payload.type, 'order') as MarketplaceEvent['type'],
      resourceId: scalar(payload.orderId) || undefined,
      payload,
    };
  }
}

class MercadoLivreAdapter extends MockAdapter {
  constructor() {
    super('mercado_livre', false);
  }
  authorizationUrl(state: string, redirectUri: string) {
    const url = new URL('https://auth.mercadolivre.com.br/authorization');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', required('MERCADO_LIVRE_CLIENT_ID'));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }
  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<MarketplaceTokens> {
    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: required('MERCADO_LIVRE_CLIENT_ID'),
        client_secret: required('MERCADO_LIVRE_CLIENT_SECRET'),
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!response.ok)
      throw new Error(`Mercado Livre OAuth: ${response.status}`);
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      user_id: number;
      scope?: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
      externalAccountId: String(data.user_id),
      displayName: `Mercado Livre ${data.user_id}`,
      scopes: data.scope?.split(' ') ?? [],
    };
  }
}

class ShopeeAdapter extends MockAdapter {
  constructor() {
    super('shopee', false);
  }
  authorizationUrl(state: string, redirectUri: string) {
    const partnerId = required('SHOPEE_PARTNER_ID');
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/shop/auth_partner';
    const sign = createHmac('sha256', required('SHOPEE_PARTNER_KEY'))
      .update(`${partnerId}${path}${timestamp}`)
      .digest('hex');
    const url = new URL(`https://partner.shopeemobile.com${path}`);
    url.searchParams.set('partner_id', partnerId);
    url.searchParams.set('timestamp', String(timestamp));
    url.searchParams.set('sign', sign);
    url.searchParams.set(
      'redirect',
      `${redirectUri}?state=${encodeURIComponent(state)}`,
    );
    return url.toString();
  }
  async exchangeCode(codeWithShop: string): Promise<MarketplaceTokens> {
    const [code, shopId] = codeWithShop.split(':');
    if (!code || !shopId) throw new Error('SHOPEE_CALLBACK_INVALID');
    const partnerId = required('SHOPEE_PARTNER_ID');
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/token/get';
    const sign = createHmac('sha256', required('SHOPEE_PARTNER_KEY'))
      .update(`${partnerId}${path}${timestamp}`)
      .digest('hex');
    const url = new URL(`https://partner.shopeemobile.com${path}`);
    url.searchParams.set('partner_id', partnerId);
    url.searchParams.set('timestamp', String(timestamp));
    url.searchParams.set('sign', sign);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code,
        shop_id: Number(shopId),
        partner_id: Number(partnerId),
      }),
    });
    if (!response.ok) throw new Error(`Shopee OAuth: ${response.status}`);
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expire_in?: number;
      error?: string;
      message?: string;
    };
    if (!data.access_token)
      throw new Error(data.message ?? data.error ?? 'Shopee OAuth inválido.');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expire_in
        ? new Date(Date.now() + data.expire_in * 1000).toISOString()
        : undefined,
      externalAccountId: shopId,
      displayName: `Shopee ${shopId}`,
      scopes: ['listings', 'orders', 'inventory'],
    };
  }
}

export function integrationsUseMock() {
  return process.env.INTEGRATIONS_MODE !== 'live';
}

export function isProviderEnabled(provider: MarketplaceProvider) {
  const value =
    process.env[
      provider === 'mercado_livre' ? 'MERCADO_LIVRE_ENABLED' : 'SHOPEE_ENABLED'
    ];
  return value !== 'false';
}

export function getMarketplaceAdapter(
  provider: MarketplaceProvider,
): MarketplaceAdapter {
  if (!isProviderEnabled(provider))
    throw new Error(`${provider.toUpperCase()}_DISABLED`);
  if (integrationsUseMock()) return new MockAdapter(provider);
  return provider === 'mercado_livre'
    ? new MercadoLivreAdapter()
    : new ShopeeAdapter();
}
