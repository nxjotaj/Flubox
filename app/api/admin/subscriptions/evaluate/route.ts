import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await requireAccountPermission(user, 'settings.manage');
    const now = new Date();
    const rows = await getD1()
      .prepare(
        `SELECT s.id,s.organization_id organizationId,s.status,s.current_period_end periodEnd,s.grace_period_days graceDays,s.cancel_at_period_end cancelAtPeriodEnd FROM subscriptions s JOIN organizations o ON o.id=s.organization_id WHERE o.type='supplier' AND s.current_period_end IS NOT NULL AND s.status IN ('active','grace_period','past_due')`,
      )
      .all<{
        id: string;
        organizationId: string;
        status: string;
        periodEnd: string;
        graceDays: number;
        cancelAtPeriodEnd: boolean;
      }>();
    let suspended = 0;
    let gracePeriod = 0;
    let cancelled = 0;
    for (const row of rows.results) {
      const periodEnd = new Date(row.periodEnd);
      if (now <= periodEnd) continue;
      if (row.cancelAtPeriodEnd) {
        await getD1().batch([
          getD1()
            .prepare(
              `UPDATE subscriptions SET status='cancelled',cancel_at_period_end=false,cancelled_at=?,updated_at=? WHERE id=?`,
            )
            .bind(now.toISOString(), now.toISOString(), row.id),
          getD1()
            .prepare(
              `UPDATE organizations SET status='suspended',updated_at=? WHERE id=?`,
            )
            .bind(now.toISOString(), row.organizationId),
          getD1()
            .prepare(
              `INSERT INTO subscription_events (id,subscription_id,type,reason,occurred_at,created_at) VALUES (?,?,'subscription_cancelled','Fim do período contratado',?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              row.id,
              now.toISOString(),
              now.toISOString(),
            ),
        ]);
        cancelled++;
        continue;
      }
      const graceEnd = new Date(periodEnd.getTime() + row.graceDays * 86400000);
      if (now > graceEnd) {
        await getD1().batch([
          getD1()
            .prepare(
              `UPDATE subscriptions SET status='suspended',updated_at=? WHERE id=?`,
            )
            .bind(now.toISOString(), row.id),
          getD1()
            .prepare(
              `UPDATE organizations SET status='suspended',updated_at=? WHERE id=?`,
            )
            .bind(now.toISOString(), row.organizationId),
          getD1()
            .prepare(
              `INSERT INTO subscription_events (id,subscription_id,type,reason,occurred_at,created_at) VALUES (?,?,'suspended','grace_period_expired',?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              row.id,
              now.toISOString(),
              now.toISOString(),
            ),
          getD1()
            .prepare(
              `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,created_at) VALUES (?,?,?,'subscription.suspended','subscription',?,?,'grace_period_expired',?)`,
            )
            .bind(
              crypto.randomUUID(),
              account.user.id,
              row.organizationId,
              row.id,
              requestId,
              now.toISOString(),
            ),
        ]);
        suspended++;
      } else if (row.status !== 'grace_period') {
        await getD1().batch([
          getD1()
            .prepare(
              `UPDATE subscriptions SET status='grace_period',updated_at=? WHERE id=?`,
            )
            .bind(now.toISOString(), row.id),
          getD1()
            .prepare(
              `INSERT INTO subscription_events (id,subscription_id,type,reason,occurred_at,created_at) VALUES (?,?,'grace_period_started','renewal_payment_pending',?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              row.id,
              now.toISOString(),
              now.toISOString(),
            ),
          getD1()
            .prepare(
              `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,created_at) VALUES (?,?,?,'subscription.grace_period_started','subscription',?,?,'renewal_payment_pending',?)`,
            )
            .bind(
              crypto.randomUUID(),
              account.user.id,
              row.organizationId,
              row.id,
              requestId,
              now.toISOString(),
            ),
        ]);
        gracePeriod++;
      }
    }
    await getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'subscriptions.evaluated','subscription','all',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        requestId,
        JSON.stringify({
          evaluated: rows.results.length,
          gracePeriod,
          suspended,
          cancelled,
        }),
        now.toISOString(),
      )
      .run();
    return Response.json({
      evaluated: rows.results.length,
      gracePeriod,
      suspended,
      cancelled,
      requestId,
    });
  } catch (error) {
    logError(error, { requestId, route: 'subscription evaluation' });
    return Response.json(
      { error: 'Não foi possível avaliar assinaturas.', requestId },
      { status: 500 },
    );
  }
}
