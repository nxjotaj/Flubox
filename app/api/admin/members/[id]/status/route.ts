import { z } from 'zod';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';

const schema = z.object({
  status: z.enum(['active', 'revoked']),
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
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const member = await getD1()
    .prepare(
      'SELECT organization_id organizationId FROM organization_members WHERE id=?',
    )
    .bind(id)
    .first<{ organizationId: string }>();
  if (!member)
    return Response.json({ error: 'Acesso não encontrado.' }, { status: 404 });
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare('UPDATE organization_members SET status=? WHERE id=?')
      .bind(parsed.data.status, id),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'member.status_changed','organization_member',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        member.organizationId,
        id,
        requestId,
        parsed.data.reason,
        JSON.stringify({ status: parsed.data.status }),
        now,
      ),
  ]);
  return Response.json({ status: parsed.data.status, requestId });
}
