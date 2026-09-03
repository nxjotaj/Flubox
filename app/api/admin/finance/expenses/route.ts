import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(3).max(240),
  amountCents: z.int().positive(),
  incurredAt: z.iso.date(),
  reason: z.string().trim().min(5).max(500),
});
export async function POST(request: Request) {
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
      { error: 'Revise categoria, valor, data e justificativa.', requestId },
      { status: 422 },
    );
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO manual_expenses (id,category,description,amount_cents,incurred_at,status,reason,created_by,created_at) VALUES (?,?,?,?,?,'posted',?,?,?)`,
      )
      .bind(
        id,
        parsed.data.category,
        parsed.data.description,
        parsed.data.amountCents,
        parsed.data.incurredAt,
        parsed.data.reason,
        account.user.id,
        now,
      ),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,reason,metadata,created_at) VALUES (?,?,?,'finance.expense_posted','manual_expense',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        id,
        requestId,
        parsed.data.reason,
        JSON.stringify({
          amountCents: parsed.data.amountCents,
          category: parsed.data.category,
        }),
        now,
      ),
  ]);
  return Response.json({ id, requestId }, { status: 201 });
}
