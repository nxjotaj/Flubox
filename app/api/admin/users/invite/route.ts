import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import {
  createInvitationToken,
  hashInvitationToken,
} from '@/modules/identity/invitations';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';

const roles = [
  'platform_admin',
  'supplier_owner',
  'supplier_member',
  'supplier_operator_1',
  'supplier_operator_2',
  'reseller_owner',
] as const;
const schema = z.object({
  organizationId: z.string().min(1),
  email: z.email().transform((v) => v.toLowerCase()),
  role: z.enum(roles),
});
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const admin = await requireAccountPermission(user, 'settings.manage');
  if (admin.organization.type !== 'platform')
    return Response.json(
      { error: 'Acesso negado.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Organização, e-mail e papel são obrigatórios.', requestId },
      { status: 422 },
    );
  const org = await getD1()
    .prepare('SELECT type FROM organizations WHERE id=?')
    .bind(parsed.data.organizationId)
    .first<{ type: string }>();
  if (!org)
    return Response.json(
      { error: 'Organização não encontrada.', requestId },
      { status: 404 },
    );
  const valid =
    (org.type === 'platform' && parsed.data.role === 'platform_admin') ||
    (org.type === 'supplier' && parsed.data.role.startsWith('supplier_')) ||
    (org.type === 'reseller' && parsed.data.role === 'reseller_owner');
  if (!valid)
    return Response.json(
      { error: 'Papel incompatível com a organização.', requestId },
      { status: 422 },
    );
  const now = new Date();
  if (org.type === 'supplier') {
    const occupied = await getD1()
      .prepare(
        `SELECT (SELECT COUNT(*) FROM organization_members WHERE organization_id=? AND status='active')+(SELECT COUNT(*) FROM organization_invitations WHERE organization_id=? AND status='pending' AND expires_at>?) total`,
      )
      .bind(
        parsed.data.organizationId,
        parsed.data.organizationId,
        now.toISOString(),
      )
      .first<{ total: number }>();
    if (Number(occupied?.total ?? 0) >= 4)
      return Response.json(
        {
          error: 'O fornecedor já possui os quatro acessos permitidos.',
          requestId,
        },
        { status: 409 },
      );
  }
  const token = createInvitationToken();
  const hash = await hashInvitationToken(token);
  const expires = new Date(now.getTime() + 7 * 86400000).toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO organization_invitations (id,organization_id,email,role_id,status,token_hash,invited_by,expires_at,created_at) VALUES (?,?,?,?,'pending',?,?,?,?) ON CONFLICT(organization_id,email) DO UPDATE SET role_id=excluded.role_id,status='pending',token_hash=excluded.token_hash,invited_by=excluded.invited_by,expires_at=excluded.expires_at,created_at=excluded.created_at`,
      )
      .bind(
        crypto.randomUUID(),
        parsed.data.organizationId,
        parsed.data.email,
        `role:${parsed.data.role}`,
        hash,
        admin.user.id,
        expires,
        now.toISOString(),
      ),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'admin.user_invited','organization_invitation',?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        admin.user.id,
        parsed.data.organizationId,
        parsed.data.email,
        requestId,
        JSON.stringify({ role: parsed.data.role }),
        now.toISOString(),
      ),
  ]);
  return Response.json(
    {
      activationPath: `/convites/aceitar?token=${token}`,
      expiresAt: expires,
      requestId,
    },
    { status: 201 },
  );
}
