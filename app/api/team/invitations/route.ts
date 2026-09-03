import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import {
  createInvitationToken,
  hashInvitationToken,
} from '@/modules/identity/invitations';
import { z } from 'zod';

const schema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum([
    'supplier_member',
    'supplier_operator_1',
    'supplier_operator_2',
  ]),
});
export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await requireAccountPermission(user, 'organization.manage');
    if (account.organization.type !== 'supplier' || account.role !== 'supplier_owner')
      return Response.json(
        { error: 'Somente o proprietário do fornecedor gerencia a equipe.', requestId },
        { status: 403 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Informe um e-mail válido.', requestId },
        { status: 422 },
      );
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 86400000);
    const occupied = await getD1()
      .prepare(
        `SELECT (SELECT COUNT(*) FROM organization_members WHERE organization_id=? AND status IN ('active','invited')) + (SELECT COUNT(*) FROM organization_invitations WHERE organization_id=? AND status='pending' AND expires_at>?) total`,
      )
      .bind(account.organization.id, account.organization.id, now.toISOString())
      .first<{ total: number }>();
    if (Number(occupied?.total ?? 0) >= 4)
      return Response.json(
        { error: 'O fornecedor já utiliza os quatro acessos permitidos.', requestId },
        { status: 409 },
      );
    const role = parsed.data.role;
    if (role.startsWith('supplier_operator_')) {
      const roleTaken = await getD1()
        .prepare(
          `SELECT 1 FROM organization_members m JOIN roles r ON r.id=m.role_id WHERE m.organization_id=? AND m.status='active' AND r.key=? UNION ALL SELECT 1 FROM organization_invitations i JOIN roles r ON r.id=i.role_id WHERE i.organization_id=? AND i.status='pending' AND i.expires_at>? AND r.key=? LIMIT 1`,
        )
        .bind(account.organization.id, role, account.organization.id, now.toISOString(), role)
        .first();
      if (roleTaken)
        return Response.json(
          { error: 'Esta posição de operador já está ocupada ou convidada.', requestId },
          { status: 409 },
        );
    }
    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    await getD1().batch([
      getD1()
        .prepare(
          `INSERT INTO organization_invitations (id, organization_id, email, role_id, status, token_hash, invited_by, expires_at, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?) ON CONFLICT(organization_id, email) DO UPDATE SET status='pending', token_hash=excluded.token_hash, invited_by=excluded.invited_by, expires_at=excluded.expires_at, accepted_by=NULL, accepted_at=NULL, created_at=excluded.created_at`,
        )
        .bind(
          crypto.randomUUID(),
          account.organization.id,
          parsed.data.email,
          `role:${role}`,
          tokenHash,
          account.user.id,
          expires.toISOString(),
          now.toISOString(),
        ),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id, actor_user_id, organization_id, action, entity_type, entity_id, request_id, metadata, created_at) VALUES (?, ?, ?, 'member.invited', 'organization_invitation', ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          parsed.data.email,
          requestId,
          JSON.stringify({ email: parsed.data.email, role }),
          now.toISOString(),
        ),
    ]);
    return Response.json(
      {
        status: 'pending',
        activationPath: `/convites/aceitar?token=${token}`,
        message:
          'Convite criado. Compartilhe o link de ativação por um canal seguro enquanto o e-mail não estiver configurado.',
        requestId,
      },
      { status: 201 },
    );
  } catch (error) {
    logError(error, { requestId, route: 'POST /api/team/invitations' });
    return Response.json(
      { error: 'Não foi possível registrar o convite.', requestId },
      { status: 500 },
    );
  }
}
