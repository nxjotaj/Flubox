import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({ productId: z.uuid() });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ listId: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'reseller')
    return Response.json(
      { error: 'Acesso negado.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Produto inválido.', requestId },
      { status: 422 },
    );
  const { listId } = await params;
  const owned = await getD1()
    .prepare(
      `SELECT l.id FROM product_lists l JOIN products p ON p.id=? AND p.status='approved' WHERE l.id=? AND l.organization_id=?`,
    )
    .bind(parsed.data.productId, listId, account.organization.id)
    .first();
  if (!owned)
    return Response.json(
      { error: 'Lista ou produto indisponível.', requestId },
      { status: 404 },
    );
  await getD1()
    .prepare(
      'INSERT OR IGNORE INTO product_list_items (list_id,product_id,created_at) VALUES (?,?,?)',
    )
    .bind(listId, parsed.data.productId, new Date().toISOString())
    .run();
  return Response.json({ added: true, requestId });
}
