import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { CircleDollarSign, Download, Landmark, ReceiptText } from 'lucide-react';
import {
  AdminSectionWorkspace,
  type AdminWorkspaceRow,
} from '@/components/admin-section-workspace';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function FinancePage() {
  const user = await requireAuthenticatedUser('/financeiro');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const [balance, entries, payouts, subscription] = await Promise.all([
    getD1()
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0) balance FROM ledger_entries WHERE organization_id=? AND status='posted'`,
      )
      .bind(account.organization.id)
      .first<{ balance: number }>(),
    getD1()
      .prepare(
        `SELECT id,account,direction,amount_cents amountCents,currency,status,reference_type referenceType,reference_id referenceId,created_at createdAt FROM ledger_entries WHERE organization_id=? ORDER BY created_at DESC LIMIT 100`,
      )
      .bind(account.organization.id)
      .all<{
        id: string;
        account: string;
        direction: string;
        amountCents: number;
        currency: string;
        status: string;
        referenceType: string;
        referenceId: string;
        createdAt: string;
      }>(),
    getD1()
      .prepare(
        `SELECT status,gross_cents grossCents,fee_cents feeCents,net_cents netCents,scheduled_at scheduledAt,paid_at paidAt FROM payouts WHERE organization_id=? ORDER BY created_at DESC LIMIT 20`,
      )
      .bind(account.organization.id)
      .all<{
        status: string;
        grossCents: number;
        feeCents: number;
        netCents: number;
        scheduledAt: string | null;
        paidAt: string | null;
      }>(),
    getD1()
      .prepare(
        `SELECT status,monthly_amount_cents amountCents,current_period_end periodEnd,grace_period_days graceDays FROM subscriptions WHERE organization_id=?`,
      )
      .bind(account.organization.id)
      .first<{
        status: string;
        amountCents: number;
        periodEnd: string | null;
        graceDays: number;
      }>(),
  ]);
  return (
    <AppShell account={account} activePath="/financeiro">
      <section className="page-heading"><div>
        <span className="page-kicker"><CircleDollarSign /> Valores derivados do ledger</span>
        <h1>Centro financeiro {account.organization.type==='supplier'?'do fornecedor':'do revendedor'}</h1>
        <p>Saldo, pagamentos, taxas e repasses conciliados da sua organização.</p></div>
        <a className="secondary-action" href="/api/finance/ledger.csv"><Download /> Exportar movimentações</a>
      </section>
        <div className="finance-summary">
          <article>
            <CircleDollarSign />
            <small>Saldo contabilizado</small>
            <strong>
              {((balance?.balance ?? 0) / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
          </article>
          <article>
            <ReceiptText />
            <small>Assinatura</small>
            <strong>{subscription?.status ?? 'não configurada'}</strong>
            {subscription && (
              <span>
                {(subscription.amountCents / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
                /mês
              </span>
            )}
          </article>
          <article>
            <Landmark />
            <small>Repasses</small>
            <strong>{payouts.results.length}</strong>
            <span>registros reais</span>
          </article>
        </div>
        <h2>Movimentações</h2>
        <AdminSectionWorkspace
          section="financeiro"
          columns={[
            ['account', 'Conta'],
            ['direction', 'Direção'],
            ['amount', 'Valor'],
            ['status', 'Status'],
            ['reference', 'Referência'],
            ['createdAt', 'Data'],
          ]}
          rows={entries.results.map(
            (entry): AdminWorkspaceRow => ({
              key: entry.id,
              status: entry.status,
              searchText: `${entry.account} ${entry.direction} ${entry.status} ${entry.referenceType} ${entry.referenceId}`,
              cells: {
                account: entry.account.replaceAll('_', ' '),
                direction: entry.direction,
                amount: `${entry.direction === 'credit' ? '+' : '-'} ${(Number(entry.amountCents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                status: entry.status.replaceAll('_', ' '),
                reference: `${entry.referenceType} · ${entry.referenceId}`,
                createdAt: new Date(entry.createdAt).toLocaleString('pt-BR'),
              },
            }),
          )}
        />
    </AppShell>
  );
}
