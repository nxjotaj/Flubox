export type MarketplaceProvider = 'mercado_livre' | 'shopee';
export type ChannelConnectionStatus =
  | 'pending'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'error';
export type ChannelListingStatus =
  | 'draft'
  | 'validating'
  | 'publishing'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'error'
  | 'unlinked';

export type PricingRule =
  | { mode: 'margin'; marginBasisPoints: number }
  | { mode: 'fixed'; fixedPriceCents: number };

export type MarketplaceTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  externalAccountId: string;
  displayName: string;
  scopes: string[];
};

export type MarketplaceListing = {
  externalListingId: string;
  externalVariantId?: string;
  externalSku?: string;
  title: string;
  priceCents: number;
  stock: number;
  status: ChannelListingStatus;
  url?: string;
};

export type PublishListingInput = {
  sku: string;
  title: string;
  description: string;
  categoryId: string;
  priceCents: number;
  stock: number;
  imageUrls: string[];
  attributes: Record<string, string>;
};

export type MarketplaceEvent = {
  externalEventId: string;
  connectionExternalId?: string;
  type: 'order' | 'order_status' | 'question' | 'return' | 'cancellation';
  resourceId?: string;
  payload: Record<string, unknown>;
};

export interface MarketplaceAdapter {
  readonly provider: MarketplaceProvider;
  authorizationUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<MarketplaceTokens>;
  refreshToken(refreshToken: string): Promise<MarketplaceTokens>;
  listListings(accessToken: string): Promise<MarketplaceListing[]>;
  publishListing(
    accessToken: string,
    input: PublishListingInput,
  ): Promise<MarketplaceListing>;
  updateListing(
    accessToken: string,
    externalListingId: string,
    changes: {
      priceCents?: number;
      stock?: number;
      status?: 'active' | 'paused';
    },
  ): Promise<void>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  normalizeWebhook(rawBody: string): MarketplaceEvent;
}
