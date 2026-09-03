import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { createPrivateDocumentUrl } from '@/modules/documents/storage';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account)
    return Response.json({ error: 'Conta necessária.' }, { status: 403 });
  const { id } = await params;
  const document = await getD1()
    .prepare(
      `SELECT storage_key storageKey FROM documents WHERE id=? AND (?=TRUE OR organization_id=?)`,
    )
    .bind(id, account.organization.type === 'platform', account.organization.id)
    .first<{ storageKey: string }>();
  if (!document)
    return Response.json(
      { error: 'Documento não encontrado.' },
      { status: 404 },
    );
  redirect(await createPrivateDocumentUrl(document.storageKey));
}
