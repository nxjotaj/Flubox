import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom } from '@/lib/request-context';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  status: z.enum([
    'in_transit',
    'delayed',
    'delivery_attempt',
    'delivered',
    'exception',
  ]),
  description: z.string().trim().min(3).max(240),
  location: z.string().trim().max(120).optional(),
  occurredAt: z.iso.datetime(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const user = await getAuthenticatedUser();
  if (!user)
    return Response.json({ error: 'Faça login.', requestId }, { status: 401 });
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'supplier')
    return Response.json(
      { error: 'Acesso negado.', requestId },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Evento de rastreio inválido.', requestId },
      { status: 422 },
    );
  const { id } = await params;
  const shipment = await getD1()
    .prepare(
      `SELECT s.id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE o.id=? AND o.supplier_organization_id=?`,
    )
    .bind(id, account.organization.id)
    .first<{ id: string }>();
  if (!shipment)
    return Response.json(
      { error: 'Envio não encontrado.', requestId },
      { status: 404 },
    );
  await getD1()
    .prepare(
      `INSERT INTO tracking_events (id,shipment_id,status,description,location,source,occurred_at,created_at) VALUES (?,?,?,?,?,'manual',?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      shipment.id,
      parsed.data.status,
      parsed.data.description,
      parsed.data.location ?? null,
      parsed.data.occurredAt,
      new Date().toISOString(),
    )
    .run();
  return Response.json({ created: true, requestId }, { status: 201 });
}
