import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import {
  createPrivateDocumentUrl,
  removePrivateDocument,
  storePrivateDocument,
} from '@/modules/documents/storage';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
async function supplierAccount() {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const account = await getAccountContext(user);
  return account?.organization.type === 'supplier' ? account : null;
}
export async function GET() {
  const account = await supplierAccount();
  if (!account)
    return Response.json({ error: 'Acesso negado.' }, { status: 403 });
  const row = await getD1()
    .prepare(
      'SELECT logo_storage_key logo FROM supplier_profiles WHERE organization_id=?',
    )
    .bind(account.organization.id)
    .first<{ logo: string | null }>();
  if (!row?.logo)
    return Response.json({ error: 'Foto não cadastrada.' }, { status: 404 });
  redirect(await createPrivateDocumentUrl(row.logo));
}
export async function POST(request: Request) {
  const account = await supplierAccount();
  if (!account)
    return Response.json({ error: 'Acesso negado.' }, { status: 403 });
  const file = (await request.formData()).get('file');
  if (
    !(file instanceof File) ||
    !allowed.has(file.type) ||
    file.size <= 0 ||
    file.size > 5 * 1024 * 1024
  )
    return Response.json(
      { error: 'Envie JPG, PNG ou WebP de até 5 MB.' },
      { status: 422 },
    );
  const previous = await getD1()
    .prepare(
      'SELECT logo_storage_key logo FROM supplier_profiles WHERE organization_id=?',
    )
    .bind(account.organization.id)
    .first<{ logo: string | null }>();
  const key = `suppliers/${account.organization.id}/logo-${crypto.randomUUID()}`;
  await storePrivateDocument(key, file);
  await getD1()
    .prepare(
      'UPDATE supplier_profiles SET logo_storage_key=?,updated_at=? WHERE organization_id=?',
    )
    .bind(key, new Date().toISOString(), account.organization.id)
    .run();
  if (previous?.logo)
    await removePrivateDocument(previous.logo).catch(() => undefined);
  return Response.json({ updated: true });
}
