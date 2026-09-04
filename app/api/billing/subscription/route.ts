import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({ action: z.enum(['cancel', 'reactivate']) });
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const account = await getAccountContext(user);
  if (
    !account ||
    account.organization.type !== 'supplier' ||
    account.role !== 'supplier_owner'
  )
    return Response.json(
      { error: 'Somente o proprietário pode alterar a assinatura.' },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: 'Ação inválida.' }, { status: 422 });
  const cancel = parsed.data.action === 'cancel';
  const now = new Date().toISOString();
  const subscription = await getD1()
    .prepare(
      'SELECT id,status,current_period_end periodEnd FROM subscriptions WHERE organization_id=?',
    )
    .bind(account.organization.id)
    .first<{ id: string; status: string; periodEnd: string | null }>();
  if (
    !subscription ||
    !['active', 'grace_period'].includes(subscription.status)
  )
    return Response.json(
      { error: 'A assinatura não está ativa.' },
      { status: 409 },
    );
  await getD1().batch([
    getD1()
      .prepare(
        'UPDATE subscriptions SET cancel_at_period_end=?,cancelled_at=?,updated_at=? WHERE id=?',
      )
      .bind(cancel, cancel ? now : null, now, subscription.id),
    getD1()
      .prepare(
        'INSERT INTO subscription_events (id,subscription_id,type,reason,occurred_at,created_at) VALUES (?,?,?,?,?,?)',
      )
      .bind(
        crypto.randomUUID(),
        subscription.id,
        cancel ? 'cancellation_scheduled' : 'cancellation_reversed',
        cancel
          ? `Renovação cancelada; acesso mantido até ${subscription.periodEnd ?? 'o fim do período'}.`
          : 'Renovação reativada pelo fornecedor.',
        now,
        now,
      ),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,created_at) VALUES (?,?,?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        cancel
          ? 'subscription.cancellation_scheduled'
          : 'subscription.reactivated',
        'subscription',
        subscription.id,
        requestId,
        now,
      ),
  ]);
  return Response.json({ updated: true, cancelAtPeriodEnd: cancel, requestId });
}
