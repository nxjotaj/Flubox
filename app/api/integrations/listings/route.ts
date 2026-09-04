import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { publishProduct } from '@/modules/integrations/service';
import { z } from 'zod';

const schema = z.object({
  connectionId: z.uuid(),
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  pricingMode: z.enum(['margin', 'fixed']),
  value: z.coerce.number().positive(),
  safetyStock: z.coerce.number().int().min(0).max(100000).default(0),
});

export async function POST(request: Request) {
  const destination = new URL('/integracoes', request.url);
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.redirect(new URL('/entrar', request.url), 303);
    const account = await requireAccountPermission(user, 'integrations.manage');
    const values = Object.fromEntries(await request.formData());
    if (!values.variantId) delete values.variantId;
    const parsed = schema.parse(values);
    await publishProduct({
      account,
      connectionId: parsed.connectionId,
      productId: parsed.productId,
      variantId: parsed.variantId,
      rule:
        parsed.pricingMode === 'margin'
          ? {
              mode: 'margin',
              marginBasisPoints: Math.round(parsed.value * 100),
            }
          : { mode: 'fixed', fixedPriceCents: Math.round(parsed.value * 100) },
      safetyStock: parsed.safetyStock,
      requestId: requestIdFrom(request),
    });
    destination.searchParams.set('publicado', '1');
  } catch (error) {
    destination.searchParams.set(
      'erro',
      error instanceof Error ? error.message : 'Falha ao publicar',
    );
  }
  return Response.redirect(destination, 303);
}
