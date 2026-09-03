import { z } from 'zod';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';

const schema = z.object({
  resolution: z.string().trim().min(3).max(100),
  reason: z.string().trim().min(5).max(500),
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
      { error: 'Resolução e justificativa são obrigatórias.' },
      { status: 422 },
    );
  const { id } = await params;
  const now = new Date().toISOString();
  const dispute = await getD1()
    .prepare(
      'SELECT opened_by_organization_id organizationId FROM support_cases WHERE id=?',
    )
    .bind(id)
    .first<{ organizationId: string }>();
  if (!dispute)
    return Response.json({ error: 'Disputa não encontrada.' }, { status: 404 });
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE support_cases SET status='resolved',resolution=?,resolved_at=?,updated_at=? WHERE id=?`,
      )
      .bind(parsed.data.resolution, now, now, id),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'case.resolved','support_case',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        dispute.organizationId,
        id,
        requestId,
        parsed.data.reason,
        JSON.stringify({ resolution: parsed.data.resolution }),
        now,
      ),
  ]);
  return Response.json({ status: 'resolved', requestId });
}
