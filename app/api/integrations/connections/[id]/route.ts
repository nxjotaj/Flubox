import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { recordAudit } from '@/modules/audit/service';
import { requireAccountPermission } from '@/modules/identity/service';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const destination = new URL('/integracoes', request.url);
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.redirect(new URL('/entrar', request.url), 303);
    const account = await requireAccountPermission(user, 'integrations.manage');
    const { id } = await context.params;
    const now = new Date().toISOString();
    const result = await getD1()
      .prepare(
        `UPDATE sales_channel_connections SET status='revoked',encrypted_access_token=NULL,encrypted_refresh_token=NULL,token_expires_at=NULL,updated_at=? WHERE id=? AND organization_id=? RETURNING id`,
      )
      .bind(now, id, account.organization.id)
      .first<{ id: string }>();
    if (!result) throw new Error('CONNECTION_NOT_FOUND');
    await getD1()
      .prepare(
        `UPDATE sales_channel_listings SET status='paused',published_stock=0,updated_at=? WHERE connection_id=? AND organization_id=?`,
      )
      .bind(now, id, account.organization.id)
      .run();
    await recordAudit({
      actorUserId: account.user.id,
      organizationId: account.organization.id,
      action: 'integration.disconnected',
      entityType: 'sales_channel_connection',
      entityId: id,
      requestId: requestIdFrom(request),
    });
  } catch (error) {
    destination.searchParams.set(
      'erro',
      error instanceof Error ? error.message : 'Falha ao desconectar',
    );
  }
  return Response.redirect(destination, 303);
}
