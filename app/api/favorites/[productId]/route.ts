import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'reseller')
    return Response.json(
      { error: 'Acesso exclusivo para revendedores.', requestId },
      { status: 403 },
    );
  const { productId } = await params;
  const product = await getD1()
    .prepare(
      `SELECT p.id FROM products p JOIN organizations o ON o.id=p.organization_id AND o.status='active' JOIN subscriptions s ON s.organization_id=o.id AND s.status IN ('active','grace_period') WHERE p.id=? AND p.status='approved'`,
    )
    .bind(productId)
    .first();
  if (!product)
    return Response.json(
      { error: 'Produto indisponível.', requestId },
      { status: 404 },
    );
  const existing = await getD1()
    .prepare(
      'SELECT product_id FROM product_favorites WHERE organization_id=? AND product_id=?',
    )
    .bind(account.organization.id, productId)
    .first();
  const now = new Date().toISOString();
  if (existing) {
    await getD1()
      .prepare(
        'DELETE FROM product_favorites WHERE organization_id=? AND product_id=?',
      )
      .bind(account.organization.id, productId)
      .run();
  } else {
    await getD1()
      .prepare(
        'INSERT INTO product_favorites (organization_id,product_id,created_by,created_at) VALUES (?,?,?,?)',
      )
      .bind(account.organization.id, productId, account.user.id, now)
      .run();
  }
  return Response.json({ favorited: !existing, requestId });
}
