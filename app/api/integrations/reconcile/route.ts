import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { reconcileConnection } from '@/modules/integrations/service';
import { z } from 'zod';

export async function POST(request: Request) {
  const destination = new URL('/integracoes', request.url);
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.redirect(new URL('/entrar', request.url), 303);
    const account = await requireAccountPermission(user, 'integrations.manage');
    const parsed = z
      .object({ connectionId: z.uuid() })
      .parse(Object.fromEntries(await request.formData()));
    const count = await reconcileConnection({
      account,
      connectionId: parsed.connectionId,
      requestId: requestIdFrom(request),
    });
    destination.searchParams.set('sincronizados', String(count));
  } catch (error) {
    destination.searchParams.set(
      'erro',
      error instanceof Error ? error.message : 'Falha ao sincronizar',
    );
  }
  return Response.redirect(destination, 303);
}
