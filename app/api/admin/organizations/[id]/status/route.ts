import { z } from 'zod';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';

const schema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
  reason: z.string().trim().min(5).max(300),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const admin = await requireAccountPermission(user, 'settings.manage');
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Status e justificativa são obrigatórios.' },
      { status: 422 },
    );
  const { id } = await params;
  const now = new Date().toISOString();
  if (parsed.data.status === 'active') {
    const target = await getD1()
      .prepare(`SELECT type,status FROM organizations WHERE id=?`)
      .bind(id)
      .first<{ type: string; status: string }>();
    if (!target)
      return Response.json(
        { error: 'Organização não encontrada.' },
        { status: 404 },
      );
    if (target.type === 'supplier' && target.status === 'onboarding') {
      const readiness = await getD1()
        .prepare(`SELECT
        EXISTS(SELECT 1 FROM supplier_profiles WHERE organization_id=?) profile,
        (SELECT COUNT(DISTINCT type) FROM documents WHERE organization_id=? AND type IN ('company_registration','responsible_identity','address_proof')) documents,
        EXISTS(SELECT 1 FROM payment_methods WHERE organization_id=? AND status='active') payment_method,
        EXISTS(SELECT 1 FROM subscriptions WHERE organization_id=? AND status='active') subscription`)
        .bind(id, id, id, id)
        .first<{
          profile: boolean;
          documents: number;
          paymentMethod: boolean;
          subscription: boolean;
        }>();
      if (
        !readiness?.profile ||
        readiness.documents < 3 ||
        !readiness.paymentMethod ||
        !readiness.subscription
      )
        return Response.json(
          {
            error:
              'O fornecedor precisa concluir perfil, três documentos e assinatura antes da aprovação.',
          },
          { status: 409 },
        );
    }
  }
  const result = await getD1().batch([
    getD1()
      .prepare(
        `UPDATE organizations SET status=?,archived_at=CASE WHEN ?='archived' THEN ? ELSE NULL END,updated_at=? WHERE id=? AND type!='platform'`,
      )
      .bind(parsed.data.status, parsed.data.status, now, now, id),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'organization.status_changed','organization',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        id,
        id,
        requestId,
        parsed.data.reason,
        JSON.stringify({ status: parsed.data.status }),
        now,
      ),
  ]);
  if (!result[0].meta.changes)
    return Response.json(
      { error: 'Organização não encontrada.' },
      { status: 404 },
    );
  return Response.json({ status: parsed.data.status, requestId });
}
