import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
      `SELECT s.id,s.status,s.monthly_amount_cents amountCents,s.current_period_end periodEnd,s.cancel_at_period_end cancelAtPeriodEnd,pm.brand,pm.last_four lastFour,pm.expiry_month expiryMonth,pm.expiry_year expiryYear FROM subscriptions s LEFT JOIN payment_methods pm ON pm.organization_id=s.organization_id AND pm.status='active' WHERE s.organization_id=?`,
    )
    .bind(account.organization.id)
    .first<{
      id: string;
      status: string;
      amountCents: number;
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
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-h-44 bg-[#17181a] text-white">
          <CardContent className="flex h-full flex-col gap-3 py-2">
            <span className="text-xs font-bold tracking-wider text-neutral-300 uppercase">
              Situação da assinatura
            </span>
            <strong className="mt-auto text-3xl">
              {labelFor(subscription?.status ?? 'pending')}
            </strong>
            {subscription?.cancelAtPeriodEnd && (
              <b className="text-xs text-orange-200">
                Cancelamento agendado para o fim do período
              </b>
            )}
          </CardContent>
        </Card>
        <Card className="min-h-44">
          <CardContent className="flex h-full flex-col gap-3 py-2">
            <CalendarDays className="text-primary" />
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Próximo vencimento
            </span>
            <strong className="mt-auto text-xl">
              {subscription?.periodEnd
                ? new Date(subscription.periodEnd).toLocaleDateString('pt-BR')
                : 'A definir'}
            </strong>
          </CardContent>
        </Card>
        <Card className="min-h-44">
          <CardContent className="flex h-full flex-col gap-3 py-2">
            <CreditCard className="text-primary" />
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Forma de cobrança
            </span>
            <strong className="mt-auto text-xl">
              {subscription?.brand
                ? `${subscription.brand} final ${subscription.lastFour}`
                : 'Não cadastrada'}
            </strong>
            {subscription?.expiryMonth && (
              <small className="text-muted-foreground">
                Validade {String(subscription.expiryMonth).padStart(2, '0')}/
                {subscription.expiryYear}
              </small>
            )}
          </CardContent>
        </Card>
      </section>
      {!active && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Ativar assinatura</CardTitle>
            <CardDescription>
              Cadastre a forma de cobrança para liberar a operação do
              fornecedor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodForm />
          </CardContent>
        </Card>
      )}
      {active && (
        <SubscriptionActions
          active
          cancellationScheduled={Boolean(subscription?.cancelAtPeriodEnd)}
        />
      )}
      <Card className="mt-4">
        <CardHeader className="grid grid-cols-[auto_1fr] gap-x-3">
          <ReceiptText className="text-primary" />
          <div>
            <CardTitle>Histórico da mensalidade</CardTitle>
            <CardDescription>
              Pagamentos, alterações de cobrança e cancelamentos.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {history.results.length ? (
            <div className="divide-y">
              {history.results.map((event, index) => (
                <article
                  className="flex items-start justify-between gap-5 py-4"
                  key={`${event.occurredAt}-${index}`}
                >
                  <div className="grid gap-1">
                    <strong>{labelFor(event.type)}</strong>
                    <small className="text-muted-foreground">
                      {event.reason}
                    </small>
                  </div>
                  <div className="grid shrink-0 gap-1 text-right">
                    {event.amountCents !== null && (
                      <b>{money(event.amountCents)}</b>
                    )}
                    <time className="text-xs text-muted-foreground">
                      {new Date(event.occurredAt).toLocaleString('pt-BR')}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Nenhum lançamento registrado ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
