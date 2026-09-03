import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(3).max(180),
  administrativeNotes: z.string().trim().max(4000).optional(),
  phone: z.string().trim().min(8).max(30).optional(),
  cpf: z.string().trim().max(14).optional(),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await requireAccountPermission(user, 'organization.manage');
  if (account.organization.type !== 'platform')
    return Response.json(
      { error: 'Acesso negado.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Revise os dados da organização.', requestId },
      { status: 422 },
    );
  const { id } = await params;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE organizations SET display_name=?,legal_name=?,administrative_notes=?,updated_at=? WHERE id=? AND type!='platform'`,
      )
      .bind(
        parsed.data.displayName,
        parsed.data.legalName,
        parsed.data.administrativeNotes ?? null,
        now,
        id,
      ),
    getD1()
      .prepare(
        `UPDATE supplier_profiles SET trade_name=?,legal_name=?,updated_at=? WHERE organization_id=?`,
      )
      .bind(parsed.data.displayName, parsed.data.legalName, now, id),
    getD1()
      .prepare(
        `UPDATE reseller_profiles SET full_name=?,phone=COALESCE(?,phone),cpf=COALESCE(?,cpf),updated_at=? WHERE organization_id=?`,
      )
      .bind(
        parsed.data.displayName,
        parsed.data.phone ?? null,
        parsed.data.cpf ?? null,
        now,
        id,
      ),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'organization.details_updated','organization',?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        id,
        requestId,
        JSON.stringify(parsed.data),
        now,
      ),
  ]);
  return Response.json({ updated: true, requestId });
}
