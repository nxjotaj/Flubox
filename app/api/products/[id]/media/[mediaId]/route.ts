import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import {
  createPrivateDocumentUrl,
  removePrivateDocument,
} from '@/modules/documents/storage';
import {
  getAccountContext,
  requireAccountPermission,
} from '@/modules/identity/service';
import { redirect } from 'next/navigation';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account)
    return Response.json({ error: 'Conta necessária.' }, { status: 403 });
  const { id, mediaId } = await params;
  const media = await getD1()
    .prepare(
      `SELECT pm.storage_key storageKey FROM product_media pm JOIN products p ON p.id=pm.product_id WHERE pm.id=? AND pm.product_id=? AND (?=TRUE OR p.organization_id=? OR (p.status='approved' AND EXISTS(SELECT 1 FROM organizations o WHERE o.id=p.organization_id AND o.status='active')))`,
    )
    .bind(
      mediaId,
      id,
      account.organization.type === 'platform',
      account.organization.id,
    )
    .first<{ storageKey: string }>();
  if (!media)
    return Response.json({ error: 'Imagem não encontrada.' }, { status: 404 });
  redirect(await createPrivateDocumentUrl(media.storageKey));
}
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const account = await requireAccountPermission(user, 'products.manage');
  const { id, mediaId } = await params;
  const media = await getD1()
    .prepare(
      `SELECT pm.storage_key storageKey FROM product_media pm JOIN products p ON p.id=pm.product_id WHERE pm.id=? AND pm.product_id=? AND p.organization_id=?`,
    )
    .bind(mediaId, id, account.organization.id)
    .first<{ storageKey: string }>();
  if (!media)
    return Response.json({ error: 'Imagem não encontrada.' }, { status: 404 });
  await removePrivateDocument(media.storageKey);
  await getD1()
    .prepare('DELETE FROM product_media WHERE id=? AND product_id=?')
    .bind(mediaId, id)
    .run();
  return Response.json({ deleted: true });
}
