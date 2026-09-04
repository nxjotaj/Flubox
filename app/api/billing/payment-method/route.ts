import { createHash } from 'node:crypto';
import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { logError, requestIdFrom } from '@/lib/request-context';
import {
  cardBrand,
  isValidCardNumber,
  onlyCardDigits,
} from '@/modules/billing/card';
import { getAccountContext } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({
  holderName: z.string().trim().min(3).max(120),
  number: z.string().min(13).max(30),
  expiryMonth: z.int().min(1).max(12),
  expiryYear: z
    .int()
    .min(new Date().getFullYear())
    .max(new Date().getFullYear() + 20),
  cvv: z.string().regex(/^\d{3,4}$/),
  mode: z.enum(['activate', 'replace']).default('activate'),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    if (process.env.NODE_ENV === 'production')
      return Response.json(
        {
          error:
            'O PSP precisa ser configurado para tokenizar cartões em produção.',
          requestId,
        },
        { status: 503 },
      );
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await getAccountContext(user);
    if (!account || account.organization.type !== 'supplier')
      return Response.json(
        { error: 'Acesso exclusivo para fornecedores.', requestId },
        { status: 403 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || !isValidCardNumber(parsed.data.number))
      return Response.json(
        { error: 'Revise os dados do cartão de teste.', requestId },
        { status: 422 },
      );
    const digits = onlyCardDigits(parsed.data.number);
    const token = `dev_pm_${createHash('sha256').update(`${account.organization.id}:${digits}:${parsed.data.expiryMonth}:${parsed.data.expiryYear}`).digest('hex').slice(0, 32)}`;
    const now = new Date().toISOString();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await getD1().batch([
      getD1()
        .prepare(
          `UPDATE payment_methods SET status='replaced',updated_at=? WHERE organization_id=? AND status='active'`,
        )
        .bind(now, account.organization.id),
      getD1()
        .prepare(
          `INSERT INTO payment_methods (id,organization_id,provider,provider_method_token,brand,last_four,expiry_month,expiry_year,status,created_by,created_at,updated_at) VALUES (?,?, 'development',?,?,?,?,?,'active',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.organization.id,
          token,
          cardBrand(digits),
          digits.slice(-4),
          parsed.data.expiryMonth,
          parsed.data.expiryYear,
          account.user.id,
          now,
          now,
        ),
      ...(parsed.data.mode === 'activate'
        ? [
            getD1()
              .prepare(
                `UPDATE subscriptions SET status='active',provider='development',external_reference=?,current_period_start=?,current_period_end=?,updated_at=? WHERE organization_id=?`,
              )
              .bind(
                `dev_subscription_${account.organization.id}`,
                now,
                periodEnd.toISOString(),
                now,
                account.organization.id,
              ),
            getD1()
              .prepare(
                `UPDATE organizations SET status='active',updated_at=? WHERE id=?`,
              )
              .bind(now, account.organization.id),
          ]
        : []),
      getD1()
        .prepare(
          `INSERT INTO subscription_events (id,subscription_id,type,amount_cents,external_reference,reason,occurred_at,created_at) SELECT ?,id,?,CASE WHEN ?='payment_succeeded' THEN monthly_amount_cents ELSE NULL END,?,?,?,? FROM subscriptions WHERE organization_id=?`,
        )
        .bind(
          crypto.randomUUID(),
          parsed.data.mode === 'activate'
            ? 'payment_succeeded'
            : 'payment_method_updated',
          parsed.data.mode === 'activate'
            ? 'payment_succeeded'
            : 'payment_method_updated',
          `dev_invoice_${Date.now()}`,
          parsed.data.mode === 'activate'
            ? 'Cobrança recorrente aprovada no ambiente de desenvolvimento'
            : 'Forma de cobrança atualizada pelo fornecedor',
          now,
          now,
          account.organization.id,
        ),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'subscription.payment_method_added','subscription',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          account.organization.id,
          requestId,
          JSON.stringify({
            provider: 'development',
            brand: cardBrand(digits),
            lastFour: digits.slice(-4),
          }),
          now,
        ),
    ]);
    return Response.json({
      brand: cardBrand(digits),
      lastFour: digits.slice(-4),
      status: 'active',
      requestId,
    });
  } catch (error) {
    logError(error, { requestId, route: 'POST billing payment method' });
    return Response.json(
      { error: 'Não foi possível ativar a assinatura.', requestId },
      { status: 500 },
    );
  }
}
