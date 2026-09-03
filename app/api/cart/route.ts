import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  quantity: z.int().min(0).max(100),
});
async function context() {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const account = await getAccountContext(user);
  return account?.organization.type === 'reseller' ? account : null;
}
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const account = await context();
  if (!account)
    return Response.json(
      { error: 'Acesso exclusivo para revendedores.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Produto e quantidade são obrigatórios.', requestId },
      { status: 422 },
    );
  const product = await getD1()
    .prepare(
      `SELECT p.id,p.organization_id supplierId FROM products p JOIN organizations o ON o.id=p.organization_id AND o.status='active' JOIN subscriptions s ON s.organization_id=o.id AND s.status IN ('active','grace_period') JOIN product_favorites f ON f.product_id=p.id AND f.organization_id=? LEFT JOIN product_variants v ON v.id=? AND v.product_id=p.id AND v.status='active' WHERE p.id=? AND p.status='approved' AND ((? IS NOT NULL AND v.id IS NOT NULL) OR (? IS NULL AND NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id=p.id AND pv.status='active')))`,
    )
    .bind(account.organization.id,parsed.data.variantId??null,parsed.data.productId,parsed.data.variantId??null,parsed.data.variantId??null)
    .first<{ id: string; supplierId: string }>();
  if (!product)
    return Response.json(
      { error: 'Vincule o produto e escolha uma variação disponível.', requestId },
      { status: 404 },
    );
  const existingSupplier = await getD1()
    .prepare(
      `SELECT p.organization_id supplierId FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.organization_id=? LIMIT 1`,
    )
    .bind(account.organization.id)
    .first<{ supplierId: string }>();
  if (existingSupplier && existingSupplier.supplierId !== product.supplierId)
    return Response.json(
      {
        error:
          'Finalize ou esvazie o carrinho atual. Cada pedido pertence a um fornecedor.',
        requestId,
      },
      { status: 409 },
    );
  const now = new Date().toISOString();
  if (parsed.data.quantity === 0)
    await getD1()
      .prepare(
        `DELETE FROM cart_items WHERE organization_id=? AND product_id=?`,
      )
      .bind(account.organization.id, parsed.data.productId)
      .run();
  else
    await getD1()
      .prepare(
        `INSERT INTO cart_items (organization_id,product_id,variant_id,quantity,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(organization_id,product_id) DO UPDATE SET variant_id=excluded.variant_id,quantity=excluded.quantity,updated_at=excluded.updated_at`,
      )
      .bind(
        account.organization.id,
        parsed.data.productId,
        parsed.data.variantId??null,
        parsed.data.quantity,
        now,
        now,
      )
      .run();
  return Response.json({ saved: true, requestId });
}
export async function DELETE() {
  const account = await context();
  if (!account)
    return Response.json(
      { error: 'Acesso exclusivo para revendedores.' },
      { status: 403 },
    );
  await getD1()
    .prepare(`DELETE FROM cart_items WHERE organization_id=?`)
    .bind(account.organization.id)
    .run();
  return Response.json({ cleared: true });
}
