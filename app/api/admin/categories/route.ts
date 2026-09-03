import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  attributes: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9_]+$/),
        label: z.string().min(2),
        type: z.enum(['text', 'number', 'select', 'boolean']),
        required: z.boolean(),
        options: z.array(z.string()).optional(),
        unit: z.string().optional(),
      }),
    )
    .max(50),
});
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await requireAccountPermission(user, 'categories.manage');
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Categoria ou atributos inválidos.', requestId },
        { status: 422 },
      );
    const id = crypto.randomUUID(),
      now = new Date().toISOString(),
      d1 = getD1();
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO categories (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,'active',?,?)`,
        )
        .bind(id, parsed.data.name, parsed.data.slug, now, now),
      ...parsed.data.attributes.map((attribute, index) =>
        d1
          .prepare(
            `INSERT INTO category_attributes (id,category_id,key,label,type,required,options_json,unit,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            attribute.key,
            attribute.label,
            attribute.type,
            attribute.required ? 1 : 0,
            attribute.options ? JSON.stringify(attribute.options) : null,
            attribute.unit ?? null,
            index,
            now,
          ),
      ),
      d1
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'category.created','category',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          id,
          requestId,
          JSON.stringify({ attributeCount: parsed.data.attributes.length }),
          now,
        ),
    ]);
    return Response.json({ id, requestId }, { status: 201 });
  } catch (error) {
    logError(error, { requestId, route: 'POST category' });
    return Response.json(
      { error: 'Não foi possível criar a categoria.', requestId },
      { status: 500 },
    );
  }
}
