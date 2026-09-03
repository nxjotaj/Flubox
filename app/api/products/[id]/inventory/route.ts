import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  quantity: z.int().refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(200),
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
    const account = await requireAccountPermission(user, 'products.manage');
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error: 'Informe quantidade diferente de zero e justificativa.',
          requestId,
        },
        { status: 422 },
      );
    const row = await getD1()
      .prepare(
        `SELECT p.id,COALESCE(SUM(m.quantity),0) stock FROM products p LEFT JOIN inventory_movements m ON m.product_id=p.id WHERE p.id=? AND p.organization_id=? GROUP BY p.id`,
      )
      .bind(id, account.organization.id)
      .first<{ id: string; stock: number }>();
    if (!row)
      return Response.json(
        { error: 'Produto não encontrado.', requestId },
        { status: 404 },
      );
    const next = row.stock + parsed.data.quantity;
    if (next < 0)
      return Response.json(
        {
          error: `Ajuste recusado: estoque disponível é ${row.stock}.`,
          requestId,
        },
        { status: 409 },
      );
    const now = new Date().toISOString();
    await getD1().batch([
      getD1()
        .prepare(
          `INSERT INTO inventory_movements (id,product_id,organization_id,type,quantity,reference_type,reference_id,created_by,created_at) VALUES (?,?,?,'adjustment',?,'manual_adjustment',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          account.organization.id,
          parsed.data.quantity,
          requestId,
          account.user.id,
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'inventory.adjusted','product',?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          id,
          requestId,
          parsed.data.reason,
          JSON.stringify({
            quantity: parsed.data.quantity,
            before: row.stock,
            after: next,
          }),
          now,
        ),
    ]);
    return Response.json({ stock: next, requestId });
  } catch (error) {
    logError(error, { requestId, route: 'POST inventory adjustment' });
    return Response.json(
      { error: 'Não foi possível ajustar o estoque.', requestId },
      { status: 500 },
    );
  }
}
