import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import {
  validateDocument,
  storePrivateDocument,
} from '@/modules/documents/storage';
import { requireAccountPermission } from '@/modules/identity/service';

const ALLOWED_TYPES = new Set([
  'company_registration',
  'responsible_identity',
  'address_proof',
]);

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login para continuar.', requestId },
        { status: 401 },
      );
    const account = await requireAccountPermission(user, 'organization.manage');
    if (account.organization.type !== 'supplier')
      return Response.json(
        {
          error: 'Este documento não é necessário para seu perfil.',
          requestId,
        },
        { status: 403 },
      );
    const form = await request.formData();
    const file = form.get('file');
    const typeValue = form.get('type');
    const type = typeof typeValue === 'string' ? typeValue : '';
    if (!(file instanceof File) || !ALLOWED_TYPES.has(type))
      return Response.json(
        { error: 'Documento inválido.', requestId },
        { status: 422 },
      );
    const validationError = validateDocument(file);
    if (validationError)
      return Response.json(
        { error: validationError, requestId },
        { status: 422 },
      );
    const documentId = crypto.randomUUID();
    const key = `organizations/${account.organization.id}/documents/${documentId}`;
    const now = new Date().toISOString();
    await storePrivateDocument(key, file);
    await getD1().batch([
      getD1()
        .prepare(
          `INSERT INTO documents (id, organization_id, type, storage_key, file_name, mime_type, size_bytes, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .bind(
          documentId,
          account.organization.id,
          type,
          key,
          file.name,
          file.type,
          file.size,
          account.user.id,
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id, actor_user_id, organization_id, action, entity_type, entity_id, request_id, metadata, created_at) VALUES (?, ?, ?, 'document.uploaded', 'document', ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          documentId,
          requestId,
          JSON.stringify({ type, mimeType: file.type, sizeBytes: file.size }),
          now,
        ),
    ]);
    const count = await getD1()
      .prepare(
        `SELECT COUNT(DISTINCT type) AS total FROM documents WHERE organization_id = ? AND status IN ('pending', 'approved')`,
      )
      .bind(account.organization.id)
      .first<{ total: number }>();
    if ((count?.total ?? 0) >= 3)
      await getD1()
        .prepare(
          `UPDATE supplier_profiles SET onboarding_step = 3, updated_at = ? WHERE organization_id = ?`,
        )
        .bind(now, account.organization.id)
        .run();
    return Response.json(
      { id: documentId, status: 'pending', requestId },
      { status: 201 },
    );
  } catch (error) {
    logError(error, { requestId, route: 'POST /api/documents' });
    return Response.json(
      { error: 'Não foi possível enviar o documento agora.', requestId },
      { status: 500 },
    );
  }
}
