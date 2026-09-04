import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import {
  AdminSectionWorkspace,
  type AdminWorkspaceRow,
} from '@/components/admin-section-workspace';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { labelFor, referenceLabel } from '@/lib/presentation';
import {
  ArrowUpRight,
  CircleDollarSign,
  Download,
  ReceiptText,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { ExpenseForm } from './expense-form';
export const dynamic = 'force-dynamic';
const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default async function AdminFinancePage() {
  const user = await requireAuthenticatedUser('/admin/financeiro');
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'platform')
    redirect('/dashboard');
  const [orders, ledger, payouts, subscriptions, expenses, refunds] =
    await Promise.all([
      getD1()
        .prepare(
          `SELECT COALESCE(SUM(total_cents),0) gmv,COALESCE(SUM(commission_cents),0) commission,COUNT(*) orders FROM orders WHERE status NOT IN ('cancelled','payment_expired')`,
        )
        .first<{ gmv: number; commission: number; orders: number }>(),
      getD1()
        .prepare(
          `SELECT l.id,l.created_at AS "createdAt",o.display_name organization,l.account,l.direction,l.amount_cents AS "amountCents",l.status,l.reference_type AS "referenceType",l.reference_id AS "referenceId" FROM ledger_entries l JOIN organizations o ON o.id=l.organization_id ORDER BY l.created_at DESC LIMIT 300`,
        )
        .all<{
          id: string;
          createdAt: string;
          organization: string;
          account: string;
          direction: string;
          amountCents: number;
          status: string;
          referenceType: string;
          referenceId: string;
        }>(),
      getD1()
        .prepare(
          `SELECT COALESCE(SUM(gross_cents),0) gross,COALESCE(SUM(fee_cents),0) fees,COALESCE(SUM(net_cents) FILTER (WHERE status='paid'),0) paid,COUNT(*) FILTER (WHERE status='pending') pending FROM payouts`,
        )
        .first<{
          gross: number;
          fees: number;
          paid: number;
          pending: number;
        }>(),
      getD1()
        .prepare(
          `SELECT COUNT(*) FILTER (WHERE status IN ('past_due','suspended')) delinquent,COALESCE(SUM(monthly_amount_cents) FILTER (WHERE status IN ('past_due','suspended')),0) overdue,COALESCE(SUM(se.amount_cents) FILTER (WHERE se.type IN ('paid','payment_succeeded')),0) received FROM subscriptions s LEFT JOIN subscription_events se ON se.subscription_id=s.id`,
        )
        .first<{ delinquent: number; overdue: number; received: number }>(),
      getD1()
        .prepare(
          `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE status='posted'),0) total FROM manual_expenses`,
        )
        .first<{ total: number }>(),
      getD1()
        .prepare(
          `SELECT COALESCE(SUM(amount_cents),0) total,COUNT(*) count FROM refunds WHERE status IN ('approved','completed')`,
        )
        .first<{ total: number; count: number }>(),
    ]);
  const net =
    Number(orders?.commission ?? 0) +
    Number(subscriptions?.received ?? 0) -
    Number(payouts?.fees ?? 0) -
    Number(expenses?.total ?? 0) -
    Number(refunds?.total ?? 0);
  return (
    <AppShell account={account} activePath="/admin/financeiro">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <CircleDollarSign /> Controle financeiro integral
          </span>
          <h1>Financeiro da plataforma</h1>
          <p>
            Recebimentos, repasses, mensalidades, custos, inadimplência e
            resultado líquido.
          </p>
        </div>
        <div className="heading-actions">
          <a className="secondary-action" href="/api/finance/ledger.csv">
            <Download /> Exportar ledger
          </a>
          <ExpenseForm />
        </div>
      </section>
      <section className="finance-command-grid">
        <article>
          <span>
            <WalletCards /> GMV processado
          </span>
          <strong>{money(Number(orders?.gmv ?? 0))}</strong>
          <small>{orders?.orders ?? 0} pedidos contabilizados</small>
        </article>
        <article>
          <span>Receita da plataforma</span>
          <strong>
            {money(
              Number(orders?.commission ?? 0) +
                Number(subscriptions?.received ?? 0),
            )}
          </strong>
          <small>Comissões + mensalidades</small>
        </article>
        <article className="positive">
          <span>Resultado líquido</span>
          <strong>{money(net)}</strong>
          <small>Após taxas, despesas e reembolsos</small>
        </article>
        <article>
          <span>Repasses pagos</span>
          <strong>{money(Number(payouts?.paid ?? 0))}</strong>
          <small>{payouts?.pending ?? 0} repasses pendentes</small>
        </article>
        <article className="warning">
          <span>
            <TriangleAlert /> Inadimplência
          </span>
          <strong>{money(Number(subscriptions?.overdue ?? 0))}</strong>
          <small>
            {subscriptions?.delinquent ?? 0} fornecedores inadimplentes
          </small>
        </article>
        <article>
          <span>
            <ReceiptText /> Custos e reembolsos
          </span>
          <strong>
            {money(
              Number(payouts?.fees ?? 0) +
                Number(expenses?.total ?? 0) +
                Number(refunds?.total ?? 0),
            )}
          </strong>
          <small>{refunds?.count ?? 0} reembolsos</small>
        </article>
      </section>
      <section className="finance-breakdown surface-card">
        <div>
          <h2>Composição do resultado</h2>
          <p>Todos os valores derivam de registros financeiros persistidos.</p>
        </div>
        <dl>
          <div>
            <dt>Comissões</dt>
            <dd>{money(Number(orders?.commission ?? 0))}</dd>
          </div>
          <div>
            <dt>Mensalidades</dt>
            <dd>{money(Number(subscriptions?.received ?? 0))}</dd>
          </div>
          <div>
            <dt>Taxas de operadores</dt>
            <dd>- {money(Number(payouts?.fees ?? 0))}</dd>
          </div>
          <div>
            <dt>Despesas operacionais</dt>
            <dd>- {money(Number(expenses?.total ?? 0))}</dd>
          </div>
          <div>
            <dt>Reembolsos</dt>
            <dd>- {money(Number(refunds?.total ?? 0))}</dd>
          </div>
        </dl>
        <a href="/admin/relatorios">
          Abrir relatórios financeiros <ArrowUpRight />
        </a>
      </section>
      <AdminSectionWorkspace
        section="financeiro"
        columns={[
          ['createdAt', 'Data'],
          ['organization', 'Organização'],
          ['account', 'Conta'],
          ['direction', 'Direção'],
          ['amount', 'Valor'],
          ['status', 'Status'],
          ['reference', 'Referência'],
        ]}
        rows={ledger.results.map(
          (entry): AdminWorkspaceRow => ({
            key: entry.id,
            status: entry.status,
            searchText: `${entry.organization} ${entry.account} ${entry.direction} ${entry.referenceType} ${entry.referenceId}`,
            cells: {
              createdAt: new Date(entry.createdAt).toLocaleString('pt-BR'),
              organization: entry.organization,
              account: labelFor(entry.account),
              direction: labelFor(entry.direction),
              amount: `${entry.direction === 'credit' ? '+' : '-'} ${money(Number(entry.amountCents))}`,
              status: labelFor(entry.status),
              reference: referenceLabel(entry.referenceType, entry.referenceId),
            },
          }),
        )}
      />
    </AppShell>
  );
}
