import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  decision: z.enum(['approved', 'suspended']),
  reason: z.string().trim().min(5).max(500),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await requireAccountPermission(user, 'products.review');
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Informe decisão e justificativa.', requestId },
        { status: 422 },
      );
    const { id } = await params;
    const product = await getD1()
      .prepare('SELECT id,status FROM products WHERE id=?')
      .bind(id)
      .first<{ id: string; status: string }>();
    if (!product)
      return Response.json(
        { error: 'Produto não encontrado.', requestId },
        { status: 404 },
      );
    const now = new Date().toISOString();
    await getD1().batch([
      getD1()
        .prepare('UPDATE products SET status=?,updated_at=? WHERE id=?')
        .bind(parsed.data.decision, now, id),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'product.moderated','product',?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          id,
          requestId,
          parsed.data.reason,
          JSON.stringify({
            before: product.status,
            after: parsed.data.decision,
          }),
          now,
        ),
    ]);
    return Response.json({ id, status: parsed.data.decision, requestId });
  } catch (error) {
    logError(error, { requestId, route: 'POST product moderation' });
    return Response.json(
      { error: 'Não foi possível moderar o produto.', requestId },
      { status: 500 },
    );
  }
}
