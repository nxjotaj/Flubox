import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  amountCents: z.int().positive(),
  reason: z.string().trim().min(5).max(500),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const admin = await requireAccountPermission(user, 'settings.manage');
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Valor e justificativa são obrigatórios.', requestId },
        { status: 422 },
      );
    const { id } = await params;
    const row = await getD1()
      .prepare(
        `SELECT c.order_id orderId,o.reseller_organization_id resellerId,o.supplier_organization_id supplierId,o.total_cents totalCents,COALESCE((SELECT SUM(amount_cents) FROM refunds WHERE order_id=o.id),0) refunded FROM support_cases c JOIN orders o ON o.id=c.order_id WHERE c.id=? AND c.status IN ('open','mediation_requested')`,
      )
      .bind(id)
      .first<{
        orderId: string;
        resellerId: string;
        supplierId: string;
        totalCents: number;
        refunded: number;
      }>();
    if (!row)
      return Response.json(
        { error: 'Caso não encontrado.', requestId },
        { status: 404 },
      );
    if (parsed.data.amountCents > row.totalCents - row.refunded)
      return Response.json(
        { error: 'Valor excede o saldo reembolsável.', requestId },
        { status: 409 },
      );
    const refundId = crypto.randomUUID(),
      now = new Date().toISOString();
    await getD1().batch([
      getD1()
        .prepare(
          `INSERT INTO refunds (id,case_id,order_id,amount_cents,status,approved_by,reason,created_at) VALUES (?,?,?,?,'approved',?,?,?)`,
        )
        .bind(
          refundId,
          id,
          row.orderId,
          parsed.data.amountCents,
          admin.user.id,
          parsed.data.reason,
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO relationship_credits (id,reseller_organization_id,supplier_organization_id,order_id,refund_id,original_cents,remaining_cents,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'available',?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          row.resellerId,
          row.supplierId,
          row.orderId,
          refundId,
          parsed.data.amountCents,
          parsed.data.amountCents,
          now,
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO ledger_entries (id,order_id,organization_id,account,direction,amount_cents,currency,status,reference_type,reference_id,metadata,created_at) VALUES (?,?,?,'refund_credit','credit',?,'BRL','posted','refund',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          row.orderId,
          row.resellerId,
          parsed.data.amountCents,
          refundId,
          JSON.stringify({ supplierOrganizationId: row.supplierId }),
          now,
        ),
      getD1()
        .prepare(
          `INSERT INTO ledger_entries (id,order_id,organization_id,account,direction,amount_cents,currency,status,reference_type,reference_id,metadata,created_at) VALUES (?,?,?,'refund_debt','debit',?,'BRL','posted','refund',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          row.orderId,
          row.supplierId,
          parsed.data.amountCents,
          refundId,
          JSON.stringify({ resellerOrganizationId: row.resellerId }),
          now,
        ),
      getD1()
        .prepare(
          `UPDATE support_cases SET status='resolved',resolution='refund',resolved_at=?,updated_at=? WHERE id=?`,
        )
        .bind(now, now, id),
      getD1()
        .prepare(`UPDATE orders SET status='refunded',updated_at=? WHERE id=?`)
        .bind(now, row.orderId),
    ]);
    return Response.json(
      {
        refundId,
        status: 'approved',
        settlement: 'relationship_credit',
        requestId,
      },
      { status: 201 },
    );
  } catch (error) {
    logError(error, { requestId, route: 'admin refund' });
    return Response.json(
      { error: 'Não foi possível aprovar o reembolso.', requestId },
      { status: 500 },
    );
  }
}
