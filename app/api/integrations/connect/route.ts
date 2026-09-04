import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import {
  beginAuthorization,
  isMarketplaceProvider,
} from '@/modules/integrations/service';

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.redirect(new URL('/entrar', request.url), 303);
    const account = await requireAccountPermission(user, 'integrations.manage');
    if (account.organization.type !== 'reseller') throw new Error('FORBIDDEN');
    const data = await request.formData();
    const providerValue = data.get('provider');
    const provider = typeof providerValue === 'string' ? providerValue : '';
    if (!isMarketplaceProvider(provider)) throw new Error('INVALID_PROVIDER');
    const redirectUri = new URL(
      `/api/integrations/callback/${provider}`,
      request.url,
    ).toString();
    const url = await beginAuthorization({
      account,
      provider,
      redirectUri,
      requestId,
    });
    return Response.redirect(url, 303);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao conectar';
    const url = new URL('/integracoes', request.url);
    url.searchParams.set('erro', message);
    return Response.redirect(url, 303);
  }
}
