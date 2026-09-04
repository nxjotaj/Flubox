import { createHash } from 'node:crypto';
import { z } from 'zod';
import { consumeRateLimit } from '@/lib/rate-limit';
import { getPublicAppUrl } from '@/lib/public-url';
import { requestIdFrom, logError } from '@/lib/request-context';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Informe um e-mail válido.', requestId },
        { status: 422 },
      );

    const emailKey = createHash('sha256')
      .update(parsed.data.email)
      .digest('hex');
    const rateLimit = await consumeRateLimit(
      `auth:resend-confirmation:${emailKey}`,
      3,
      15 * 60,
    );
    if (!rateLimit.allowed)
      return Response.json(
        {
          error: 'Aguarde alguns minutos antes de solicitar outro e-mail.',
          requestId,
        },
        { status: 429 },
      );

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${getPublicAppUrl()}/auth/continue`,
      },
    });
    if (error?.status === 429)
      return Response.json(
        {
          error: 'Aguarde alguns minutos antes de solicitar outro e-mail.',
          requestId,
        },
        { status: 429 },
      );
    if (error) throw error;

    return Response.json({ sent: true, requestId });
  } catch (error) {
    logError(error, { requestId, route: 'POST resend confirmation' });
    return Response.json(
      {
        error: 'Não foi possível reenviar agora. Tente novamente em instantes.',
        requestId,
      },
      { status: 500 },
    );
  }
}
