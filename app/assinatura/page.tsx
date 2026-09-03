import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { PaymentMethodForm } from './payment-method-form';

export const dynamic = 'force-dynamic';
export default async function SubscriptionPage() {
  const user = await requireAuthenticatedUser('/assinatura');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'supplier') redirect('/dashboard');
  const subscription = await getD1()
    .prepare(
      `SELECT s.status,s.monthly_amount_cents amountCents,s.current_period_end periodEnd,pm.brand,pm.last_four lastFour,pm.expiry_month expiryMonth,pm.expiry_year expiryYear FROM subscriptions s LEFT JOIN payment_methods pm ON pm.organization_id=s.organization_id AND pm.status='active' WHERE s.organization_id=?`,
    )
    .bind(account.organization.id)
    .first<{
      status: string;
      amountCents: number;
      periodEnd: string | null;
      brand: string | null;
      lastFour: string | null;
      expiryMonth: number | null;
      expiryYear: number | null;
    }>();
  return (
    <AppShell account={account} activePath="/assinatura">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Cobrança recorrente</span>
          <h1>Assinatura do fornecedor</h1>
          <p>
            Mensalidade de{' '}
            {(subscription?.amountCents ?? 1990) / 100 === 19.9
              ? 'R$ 19,90'
              : ((subscription?.amountCents ?? 1990) / 100).toLocaleString(
                  'pt-BR',
                  { style: 'currency', currency: 'BRL' },
                )}{' '}
            por mês.
          </p>
        </div>
      </section>
      <section className="surface-card subscription-card">
        <div>
          <small>Situação</small>
          <strong>{subscription?.status ?? 'pending'}</strong>
          {subscription?.brand && (
            <p>
              {subscription.brand} final {subscription.lastFour} ·{' '}
              {subscription.expiryMonth}/{subscription.expiryYear}
            </p>
          )}
          {subscription?.periodEnd && (
            <p>
              Próxima renovação:{' '}
              {new Date(subscription.periodEnd).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        {subscription?.status !== 'active' && <PaymentMethodForm />}
      </section>
    </AppShell>
  );
}
