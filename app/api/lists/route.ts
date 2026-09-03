import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({ name: z.string().trim().min(2).max(60) });
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'reseller')
    return Response.json(
      { error: 'Acesso exclusivo para revendedores.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Informe um nome entre 2 e 60 caracteres.', requestId },
      { status: 422 },
    );
  const id = crypto.randomUUID();
  try {
    await getD1()
      .prepare(
        'INSERT INTO product_lists (id,organization_id,name,created_by,created_at) VALUES (?,?,?,?,?)',
      )
      .bind(
        id,
        account.organization.id,
        parsed.data.name,
        account.user.id,
        new Date().toISOString(),
      )
      .run();
    return Response.json(
      { id, name: parsed.data.name, requestId },
      { status: 201 },
    );
  } catch {
    return Response.json(
      { error: 'Já existe uma lista com esse nome.', requestId },
      { status: 409 },
    );
  }
}
