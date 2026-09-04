import { isMarketplaceProvider } from '@/modules/integrations/service';
import { ingestMarketplaceWebhook } from '@/modules/integrations/webhooks';

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!isMarketplaceProvider(provider))
    return Response.json({ error: 'Canal inválido.' }, { status: 404 });
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000)
    return Response.json(
      { error: 'Payload excede o limite.' },
      { status: 413 },
    );
  try {
    const result = await ingestMarketplaceWebhook({
      provider,
      rawBody,
      signature:
        request.headers.get('x-flubox-signature') ??
        request.headers.get('authorization'),
    });
    return Response.json(result, { status: result.accepted ? 200 : 401 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Falha ao processar webhook.',
      },
      { status: 422 },
    );
  }
}
