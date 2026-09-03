import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  type: z.enum(['correction', 'deletion', 'restriction', 'portability']),
  reason: z.string().trim().min(5).max(500),
});
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(user);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Informe o direito solicitado e a justificativa.', requestId },
      { status: 422 },
    );
  const id = crypto.randomUUID();
  await getD1()
    .prepare(
      `INSERT INTO data_subject_requests (id,user_id,organization_id,type,status,reason,requested_at) VALUES (?,?,?,?,'pending',?,?)`,
    )
    .bind(
      id,
      account?.user.id,
      account?.organization.id ?? null,
      parsed.data.type,
      parsed.data.reason,
      new Date().toISOString(),
    )
    .run();
  return Response.json(
    {
      id,
      status: 'pending',
      notice:
        'A solicitação será analisada considerando obrigações legais de retenção.',
      requestId,
    },
    { status: 201 },
  );
}
