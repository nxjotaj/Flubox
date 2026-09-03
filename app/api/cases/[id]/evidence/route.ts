import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import {
  storePrivateDocument,
  validateDocument,
} from '@/modules/documents/storage';
import { getAccountContext } from '@/modules/identity/service';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account)
    return Response.json(
      { error: 'Conta necessária.', requestId },
      { status: 403 },
    );
  const { id } = await params;
  const access = await getD1()
    .prepare(
      `SELECT c.id FROM support_cases c JOIN orders o ON o.id=c.order_id WHERE c.id=? AND (o.reseller_organization_id=? OR o.supplier_organization_id=?)`,
    )
    .bind(id, account.organization.id, account.organization.id)
    .first();
  if (!access)
    return Response.json(
      { error: 'Caso não encontrado.', requestId },
      { status: 404 },
    );
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File))
    return Response.json(
      { error: 'Arquivo obrigatório.', requestId },
      { status: 422 },
    );
  const invalid = validateDocument(file);
  if (invalid)
    return Response.json({ error: invalid, requestId }, { status: 422 });
  const evidenceId = crypto.randomUUID(),
    key = `cases/${id}/evidence/${evidenceId}`,
    now = new Date().toISOString();
  await storePrivateDocument(key, file);
  await getD1()
    .prepare(
      `INSERT INTO case_evidence (id,case_id,storage_key,file_name,mime_type,size_bytes,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?)`,
    )
    .bind(
      evidenceId,
      id,
      key,
      file.name,
      file.type,
      file.size,
      account.user.id,
      now,
    )
    .run();
  return Response.json({ id: evidenceId, requestId }, { status: 201 });
}
