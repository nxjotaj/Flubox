import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { labelFor } from '@/lib/presentation';
import { getAccountContext } from '@/modules/identity/service';
import { CalendarDays, CreditCard, ReceiptText } from 'lucide-react';
import { redirect } from 'next/navigation';
import { PaymentMethodForm } from './payment-method-form';
import { SubscriptionActions } from './subscription-actions';

export const dynamic = 'force-dynamic';
export default async function SubscriptionPage() {
  const user = await requireAuthenticatedUser('/assinatura');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'supplier') redirect('/dashboard');
  const subscription = await getD1()
    .prepare(
      `SELECT s.id,s.status,s.monthly_amount_cents amountCents,s.current_period_start periodStart,s.current_period_end periodEnd,s.cancel_at_period_end cancelAtPeriodEnd,pm.brand,pm.last_four lastFour,pm.expiry_month expiryMonth,pm.expiry_year expiryYear FROM subscriptions s LEFT JOIN payment_methods pm ON pm.organization_id=s.organization_id AND pm.status='active' WHERE s.organization_id=?`,
    )
    .bind(account.organization.id)
    .first<{
      id: string;
      status: string;
      amountCents: number;
      periodStart: string | null;
      periodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      brand: string | null;
      lastFour: string | null;
      expiryMonth: number | null;
      expiryYear: number | null;
    }>();
  const history = subscription
    ? await getD1()
        .prepare(
          `SELECT type,amount_cents amountCents,reason,occurred_at occurredAt FROM subscription_events WHERE subscription_id=? ORDER BY occurred_at DESC LIMIT 24`,
        )
        .bind(subscription.id)
        .all<{
          type: string;
          amountCents: number | null;
          reason: string | null;
          occurredAt: string;
        }>()
    : { results: [] };
  const money = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  const active = ['active', 'grace_period'].includes(
    subscription?.status ?? '',
  );
  return (
    <AppShell account={account} activePath="/assinatura">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Cobrança recorrente</span>
          <h1>Assinatura do fornecedor</h1>
          <p>
            Mensalidade de {money(subscription?.amountCents ?? 1990)} por mês.
          </p>
        </div>
      </section>
      <section className="subscription-summary-grid">
        <article className="surface-card subscription-status-card">
          <span>Situação da assinatura</span>
          <strong>{labelFor(subscription?.status ?? 'pending')}</strong>
          {subscription?.cancelAtPeriodEnd && (
            <b>Cancelamento agendado para o fim do período</b>
          )}
        </article>
        <article className="surface-card subscription-metric">
          <CalendarDays />
          <span>Próximo vencimento</span>
          <strong>
            {subscription?.periodEnd
              ? new Date(subscription.periodEnd).toLocaleDateString('pt-BR')
              : 'A definir'}
          </strong>
        </article>
        <article className="surface-card subscription-metric">
          <CreditCard />
          <span>Forma de cobrança</span>
          <strong>
            {subscription?.brand
              ? `${subscription.brand} final ${subscription.lastFour}`
              : 'Não cadastrada'}
          </strong>
          {subscription?.expiryMonth && (
            <small>
              Validade {String(subscription.expiryMonth).padStart(2, '0')}/
              {subscription.expiryYear}
            </small>
          )}
        </article>
      </section>
      {!active && (
        <section className="surface-card subscription-activation">
          <div>
            <h2>Ativar assinatura</h2>
            <p>
              Cadastre a forma de cobrança para liberar a operação do
              fornecedor.
            </p>
          </div>
          <PaymentMethodForm />
        </section>
      )}
      {active && (
        <SubscriptionActions
          active
          cancellationScheduled={Boolean(subscription?.cancelAtPeriodEnd)}
        />
      )}
      <section className="surface-card subscription-history">
        <header>
          <ReceiptText />
          <div>
            <h2>Histórico da mensalidade</h2>
            <p>Pagamentos, alterações de cobrança e cancelamentos.</p>
          </div>
        </header>
        {history.results.length ? (
          <div className="subscription-history-list">
            {history.results.map((event, index) => (
              <article key={`${event.occurredAt}-${index}`}>
                <div>
                  <strong>{labelFor(event.type)}</strong>
                  <small>{event.reason}</small>
                </div>
                <div>
                  {event.amountCents !== null && (
                    <b>{money(event.amountCents)}</b>
                  )}
                  <time>
                    {new Date(event.occurredAt).toLocaleString('pt-BR')}
                  </time>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">Nenhum lançamento registrado ainda.</p>
        )}
      </section>
    </AppShell>
  );
}
