import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import {
  BarChart3,
  CircleDollarSign,
  PackageCheck,
  ShoppingCart,
} from 'lucide-react';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { channelLabel } from '@/lib/presentation';
export const dynamic = 'force-dynamic';
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAuthenticatedUser('/relatorios');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const supplier = account.organization.type === 'supplier';
  const requestedPeriod = (await searchParams).period ?? '30d';
  const period = ['7d', '30d', '90d', 'all'].includes(requestedPeriod)
    ? requestedPeriod
    : '30d';
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const orderPeriod =
    period === 'all'
      ? ''
      : ` AND created_at::timestamptz >= NOW() - INTERVAL '${days} days'`;
  const joinedOrderPeriod =
    period === 'all'
      ? ''
      : ` AND o.created_at::timestamptz >= NOW() - INTERVAL '${days} days'`;
  const [summary, channels, topProducts, reputation] = await Promise.all([
    getD1()
      .prepare(
        `SELECT COUNT(*) orders,COALESCE(SUM(total_cents),0) volume,COALESCE(AVG(total_cents),0) average,SUM(CASE WHEN status='delivered' OR status='completed' THEN 1 ELSE 0 END) delivered FROM orders WHERE ${supplier ? 'supplier_organization_id' : 'reseller_organization_id'}=?${orderPeriod}`,
      )
      .bind(account.organization.id)
      .first<{
        orders: number;
        volume: number;
        average: number;
        delivered: number;
      }>(),
    getD1()
      .prepare(
        `SELECT channel,COUNT(*) total,COALESCE(SUM(total_cents),0) volume FROM orders WHERE ${supplier ? 'supplier_organization_id' : 'reseller_organization_id'}=?${orderPeriod} GROUP BY channel ORDER BY total DESC`,
      )
      .bind(account.organization.id)
      .all<{ channel: string; total: number; volume: number }>(),
    getD1()
      .prepare(
        `SELECT MAX(json_extract(i.product_snapshot,'$.title')) title,SUM(i.quantity) quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.${supplier ? 'supplier_organization_id' : 'reseller_organization_id'}=?${joinedOrderPeriod} GROUP BY i.product_id ORDER BY quantity DESC LIMIT 10`,
      )
      .bind(account.organization.id)
      .all<{ title: string; quantity: number }>(),
    supplier
      ? getD1()
          .prepare(
            `SELECT score_basis_points score,components_json components,created_at createdAt FROM reputation_snapshots WHERE organization_id=? ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(account.organization.id)
          .first<{ score: number; components: string; createdAt: string }>()
      : Promise.resolve(null),
  ]);
  return (
    <AppShell account={account} activePath="/relatorios">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <BarChart3 /> Dados operacionais em tempo real
          </span>
          <h1>Relatórios {supplier ? 'do fornecedor' : 'do revendedor'}</h1>
          <p>
            Pedidos, volume financeiro, desempenho e produtos atualizados
            automaticamente.
          </p>
        </div>
        <nav className="report-period-filter" aria-label="Período do relatório">
          {[
            ['7d', '7 dias'],
            ['30d', '30 dias'],
            ['90d', '90 dias'],
            ['all', 'Todo período'],
          ].map(([value, label]) => (
            <a
              className={period === value ? 'active' : ''}
              href={`/relatorios?period=${value}`}
              key={value}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="heading-actions">
          <a
            className="secondary-action"
            href="/api/reports/export?format=xlsx"
          >
            Exportar XLSX
          </a>
          <a className="secondary-action" href="/api/reports/export?format=pdf">
            Exportar PDF
          </a>
        </div>
      </section>
      <div className="finance-summary">
        <article>
          <ShoppingCart />
          <small>Pedidos</small>
          <strong>{summary?.orders ?? 0}</strong>
        </article>
        <article>
          <CircleDollarSign />
          <small>Volume</small>
          <strong>
            {((summary?.volume ?? 0) / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </strong>
        </article>
        <article>
          <PackageCheck />
          <small>Ticket médio</small>
          <strong>
            {((summary?.average ?? 0) / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </strong>
        </article>
        {reputation && (
          <article>
            <small>Reputação</small>
            <strong>{(reputation.score / 100).toFixed(1)}%</strong>
            <span>Índice de desempenho operacional</span>
          </article>
        )}
      </div>
      <div className="order-detail-grid">
        <section>
          <h2>Canais de origem</h2>
          {channels.results.length === 0 ? (
            <p>Sem pedidos.</p>
          ) : (
            channels.results.map((row) => (
              <article key={row.channel}>
                <strong>{channelLabel(row.channel)}</strong>
                <small>
                  {row.total} pedido(s) ·{' '}
                  {(row.volume / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </small>
              </article>
            ))
          )}
        </section>
        <section>
          <h2>Produtos mais utilizados</h2>
          {topProducts.results.length === 0 ? (
            <p>Sem giro calculável.</p>
          ) : (
            topProducts.results.map((row) => (
              <article key={row.title}>
                <strong>{row.title}</strong>
                <small>{row.quantity} unidade(s)</small>
              </article>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
