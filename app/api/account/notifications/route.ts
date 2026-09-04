import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({
  emailOperations: z.boolean(),
  emailOrders: z.boolean(),
  emailMessages: z.boolean(),
  emailMarketing: z.boolean(),
  browserNotifications: z.boolean(),
});

export async function PUT(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'Faça login.' }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account)
    return Response.json({ error: 'Conta não encontrada.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json({ error: 'Preferências inválidas.' }, { status: 422 });
  const p = parsed.data;
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO notification_preferences (user_id,organization_id,email_operations,email_orders,email_messages,email_marketing,browser_notifications,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,organization_id) DO UPDATE SET email_operations=excluded.email_operations,email_orders=excluded.email_orders,email_messages=excluded.email_messages,email_marketing=excluded.email_marketing,browser_notifications=excluded.browser_notifications,updated_at=excluded.updated_at`,
      )
      .bind(
        account.user.id,
        account.organization.id,
        p.emailOperations,
        p.emailOrders,
        p.emailMessages,
        p.emailMarketing,
        p.browserNotifications,
        now,
      ),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,created_at) VALUES (?,?,?,'notifications.updated','user',?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        account.user.id,
        requestId,
        now,
      ),
  ]);
  return Response.json({ updated: true, requestId });
}
