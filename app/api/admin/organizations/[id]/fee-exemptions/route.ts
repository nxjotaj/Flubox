import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  type: z.enum(['monthly_fee', 'commission']),
  endsAt: z.string().optional(),
  reason: z.string().trim().min(5).max(500),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await requireAccountPermission(user, 'settings.manage');
  if (account.organization.type !== 'platform')
    return Response.json(
      { error: 'Acesso negado.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Tipo, prazo e justificativa são obrigatórios.', requestId },
      { status: 422 },
    );
  const { id } = await params;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE supplier_fee_exemptions SET status='revoked',revoked_by=?,revoked_at=? WHERE organization_id=? AND type=? AND status='active'`,
      )
      .bind(account.user.id, now, id, parsed.data.type),
    getD1()
      .prepare(
        `INSERT INTO supplier_fee_exemptions (id,organization_id,type,status,starts_at,ends_at,reason,created_by,created_at) SELECT ?,?,?,'active',?,?,?,?,? WHERE EXISTS (SELECT 1 FROM organizations WHERE id=? AND type='supplier')`,
      )
      .bind(
        crypto.randomUUID(),
        id,
        parsed.data.type,
        now,
        parsed.data.endsAt || null,
        parsed.data.reason,
        account.user.id,
        now,
        id,
      ),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'supplier.fee_exemption_granted','organization',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        id,
        requestId,
        parsed.data.reason,
        JSON.stringify({ type: parsed.data.type, endsAt: parsed.data.endsAt }),
        now,
      ),
  ]);
  return Response.json({ created: true, requestId }, { status: 201 });
}

const revokeSchema = z.object({
  type: z.enum(['monthly_fee', 'commission']),
  reason: z.string().trim().min(5).max(500),
});
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await requireAccountPermission(user, 'settings.manage');
  if (account.organization.type !== 'platform')
    return Response.json(
      { error: 'Acesso negado.', requestId },
      { status: 403 },
    );
  const parsed = revokeSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Tipo e justificativa são obrigatórios.', requestId },
      { status: 422 },
    );
  const { id } = await params;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE supplier_fee_exemptions SET status='revoked',revoked_by=?,revoked_at=? WHERE organization_id=? AND type=? AND status='active'`,
      )
      .bind(account.user.id, now, id, parsed.data.type),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'supplier.fee_exemption_revoked','organization',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        id,
        requestId,
        parsed.data.reason,
        JSON.stringify({ type: parsed.data.type }),
        now,
      ),
  ]);
  return Response.json({ revoked: true, requestId });
}
