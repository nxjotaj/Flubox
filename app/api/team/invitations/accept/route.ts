import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { hashInvitationToken } from '@/modules/identity/invitations';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  syncAuthenticatedUser,
} from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Convite inválido.', requestId },
        { status: 422 },
      );
    const tokenHash = await hashInvitationToken(parsed.data.token);
    const invitation = await getD1()
      .prepare(
        `SELECT i.id,i.organization_id organizationId,i.email,i.role_id roleId,i.expires_at expiresAt,o.display_name organizationName FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id WHERE i.token_hash=? AND i.status='pending'`,
      )
      .bind(tokenHash)
      .first<{
        id: string;
        organizationId: string;
        email: string;
        roleId: string;
        expiresAt: string;
        organizationName: string;
      }>();
    if (!invitation || new Date(invitation.expiresAt) <= new Date())
      return Response.json(
        { error: 'Convite expirado ou já utilizado.', requestId },
        { status: 410 },
      );
    if (invitation.email.toLowerCase() !== authUser.email.toLowerCase())
      return Response.json(
        { error: 'Este convite pertence a outro e-mail.', requestId },
        { status: 403 },
      );
    const userId = await syncAuthenticatedUser(authUser);
    const now = new Date().toISOString();
    await getD1().batch([
      getD1()
        .prepare(
          `INSERT INTO organization_members (id,organization_id,user_id,role_id,status,created_at) VALUES (?,?,?,?,'active',?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role_id=excluded.role_id,status='active'`,
        )
        .bind(
          crypto.randomUUID(),
          invitation.organizationId,
          userId,
          invitation.roleId,
          now,
        ),
      getD1()
        .prepare(
          `UPDATE organization_invitations SET status='accepted',accepted_by=?,accepted_at=?,token_hash=NULL WHERE id=? AND status='pending'`,
        )
        .bind(userId, now, invitation.id),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'invitation.accepted','organization_invitation',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          userId,
          invitation.organizationId,
          invitation.id,
          requestId,
          JSON.stringify({ email: authUser.email }),
          now,
        ),
    ]);
    const response = Response.json({
      accepted: true,
      organizationName: invitation.organizationName,
      requestId,
    });
    response.headers.append(
      'Set-Cookie',
      `${ACTIVE_ORGANIZATION_COOKIE}=${invitation.organizationId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
    );
    return response;
  } catch (error) {
    logError(error, { requestId, route: 'accept invitation' });
    return Response.json(
      { error: 'Não foi possível aceitar o convite.', requestId },
      { status: 500 },
    );
  }
}
