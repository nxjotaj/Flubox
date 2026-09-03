import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({ body: z.string().trim().min(1).max(2000) });
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account)
    return Response.json(
      { error: 'Conta necessária.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Mensagem inválida.', requestId },
      { status: 422 },
    );
  const { id } = await params;
  const access = await getD1()
    .prepare(
      `SELECT c.id FROM support_cases c JOIN orders o ON o.id=c.order_id WHERE c.id=? AND (o.reseller_organization_id=? OR o.supplier_organization_id=?)`,
    )
    .bind(id, account.organization.id, account.organization.id)
    .first();
  if (!access)
    return Response.json(
      { error: 'Caso não encontrado.', requestId },
      { status: 404 },
    );
  const now = new Date().toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `INSERT INTO case_messages (id,case_id,author_user_id,body,created_at) VALUES (?,?,?,?,?)`,
      )
      .bind(crypto.randomUUID(), id, account.user.id, parsed.data.body, now),
    getD1()
      .prepare(`UPDATE support_cases SET updated_at=? WHERE id=?`)
      .bind(now, id),
    getD1()
      .prepare(
        `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'case.message_sent','support_case',?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        account.user.id,
        account.organization.id,
        id,
        requestId,
        JSON.stringify({ length: parsed.data.body.length }),
        now,
      ),
  ]);
  return Response.json({ created: true, requestId }, { status: 201 });
}
