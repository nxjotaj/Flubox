import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { storePrivateDocument } from '@/modules/documents/storage';
const types = new Set(['image/jpeg', 'image/png', 'image/webp']);
const max = 8 * 1024 * 1024;
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
    const product = await getD1()
      .prepare('SELECT id FROM products WHERE id=? AND organization_id=?')
      .bind(id, account.organization.id)
      .first();
    if (!product)
      return Response.json(
        { error: 'Produto não encontrado.', requestId },
        { status: 404 },
      );
    const form = await request.formData();
    const file = form.get('file');
    const altValue = form.get('altText');
    const altText = typeof altValue === 'string' ? altValue.trim() : '';
    if (
      !(file instanceof File) ||
      !types.has(file.type) ||
      file.size <= 0 ||
      file.size > max ||
      altText.length < 3
    )
      return Response.json(
        {
          error: 'Envie JPG, PNG ou WebP de até 8 MB e descreva a imagem.',
          requestId,
        },
        { status: 422 },
      );
    const count = await getD1()
      .prepare('SELECT COUNT(*) total FROM product_media WHERE product_id=?')
      .bind(id)
      .first<{ total: number }>();
    if ((count?.total ?? 0) >= 10)
      return Response.json(
        { error: 'Limite de 10 imagens atingido.', requestId },
        { status: 409 },
      );
    const mediaId = crypto.randomUUID();
    const key = `products/${id}/${mediaId}`;
    await storePrivateDocument(key, file);
    const now = new Date().toISOString();
    await getD1().batch([
      getD1()
        .prepare(
          'INSERT INTO product_media (id,product_id,storage_key,mime_type,size_bytes,alt_text,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?)',
        )
        .bind(
          mediaId,
          id,
          key,
          file.type,
          file.size,
          altText,
          count?.total ?? 0,
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'product.media_uploaded','product',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          id,
          requestId,
          JSON.stringify({ mediaId }),
          now,
        ),
    ]);
    return Response.json(
      { id: mediaId, status: 'stored', requestId },
      { status: 201 },
    );
  } catch (error) {
    logError(error, { requestId, route: 'POST product media' });
    return Response.json(
      { error: 'Não foi possível enviar a imagem.', requestId },
      { status: 500 },
    );
  }
}
