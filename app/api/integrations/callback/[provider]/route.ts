import {
  completeAuthorization,
  isMarketplaceProvider,
} from '@/modules/integrations/service';

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const url = new URL(request.url);
  const destination = new URL('/integracoes', request.url);
  try {
    if (!isMarketplaceProvider(provider)) throw new Error('INVALID_PROVIDER');
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!state || !code)
      throw new Error(
        url.searchParams.get('error') ?? 'OAUTH_CALLBACK_INVALID',
      );
    const redirectUri = new URL(
      `/api/integrations/callback/${provider}`,
      request.url,
    ).toString();
    await completeAuthorization({
      provider,
      state,
      code,
      shopId: url.searchParams.get('shop_id') ?? undefined,
      redirectUri,
    });
    destination.searchParams.set('conectado', provider);
  } catch (error) {
    destination.searchParams.set(
      'erro',
      error instanceof Error ? error.message : 'Falha no callback',
    );
  }
  return Response.redirect(destination, 303);
}
