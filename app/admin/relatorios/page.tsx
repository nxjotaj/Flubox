import { redirect } from 'next/navigation';
import {
  BarChart3,
  CircleDollarSign,
  Package,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { ExportTableButton } from '@/components/table-tools';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { AdminReportCharts } from '@/components/report-charts';

export const dynamic = 'force-dynamic';
const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default async function AdminReportsPage() {
  const user = await requireAuthenticatedUser('/admin/relatorios');
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'platform')
    redirect('/dashboard');
  const [summary, monthly, statuses, catalog, organizations] =
    await Promise.all([
      getD1()
        .prepare(
          `SELECT COUNT(*) orders,COALESCE(SUM(total_cents),0) gmv,COALESCE(SUM(commission_cents),0) revenue,(SELECT COUNT(*) FROM products WHERE status='approved') products,(SELECT COUNT(*) FROM organizations WHERE type!='platform' AND status='active') accounts FROM orders WHERE status NOT IN ('cancelled','payment_expired')`,
        )
        .first<{
          orders: number;
          gmv: number;
          revenue: number;
          products: number;
          accounts: number;
        }>(),
      getD1()
        .prepare(
          `SELECT to_char(date_trunc('month',created_at::timestamptz),'MM/YYYY') period,COUNT(*) orders,COALESCE(SUM(total_cents),0) gmv,COALESCE(SUM(commission_cents),0) revenue FROM orders GROUP BY date_trunc('month',created_at::timestamptz) ORDER BY date_trunc('month',created_at::timestamptz) DESC LIMIT 12`,
        )
        .all<{
          period: string;
          orders: number;
          gmv: number;
          revenue: number;
        }>(),
      getD1()
        .prepare(
          `SELECT status,COUNT(*) total,COALESCE(SUM(total_cents),0) value FROM orders GROUP BY status ORDER BY total DESC`,
        )
        .all<{ status: string; total: number; value: number }>(),
      getD1()
        .prepare(
          `SELECT p.status,COUNT(*) products,COALESCE(SUM((SELECT COALESCE(SUM(quantity),0) FROM inventory_movements m WHERE m.product_id=p.id)),0) stock FROM products p GROUP BY p.status ORDER BY products DESC`,
        )
        .all<{ status: string; products: number; stock: number }>(),
      getD1()
        .prepare(
          `SELECT type,status,COUNT(*) total FROM organizations WHERE type!='platform' GROUP BY type,status ORDER BY type,status`,
        )
        .all<{ type: string; status: string; total: number }>(),
    ]);
  const cards = [
    ['GMV', money(summary?.gmv ?? 0), CircleDollarSign],
    ['Receita', money(summary?.revenue ?? 0), BarChart3],
    ['Pedidos', String(summary?.orders ?? 0), ShoppingCart],
    ['Produtos', String(summary?.products ?? 0), Package],
    ['Contas ativas', String(summary?.accounts ?? 0), Users],
  ] as const;
  return (
    <AppShell account={account} activePath="/admin/relatorios">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <BarChart3 /> Inteligência operacional
          </span>
          <h1>Relatórios e indicadores</h1>
          <p>
            Visões independentes de vendas, receita, pedidos, catálogo e contas.
          </p>
        </div>
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
          <ExportTableButton
            selector="#monthly-report"
            filename="flubox-relatorio-mensal.csv"
          />
        </div>
      </section>
      <section className="metric-grid report-metrics">
        {cards.map(([label, value, Icon]) => (
          <article className="metric-card" key={label}>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Consolidado da plataforma</small>
            </div>
            <i>
              <Icon />
            </i>
          </article>
        ))}
      </section>
      <AdminReportCharts
        monthly={monthly.results.map((row) => ({
          period: row.period,
          gmv: Number(row.gmv),
          revenue: Number(row.revenue),
        }))}
        statuses={statuses.results.map((row) => ({
          status: row.status,
          total: Number(row.total),
        }))}
      />
      <div className="report-grid">
        <section className="surface-card admin-table-card">
          <header>
            <div>
              <h2>Desempenho mensal</h2>
              <p>Volume, pedidos e comissão.</p>
            </div>
          </header>
          <table id="monthly-report">
            <thead>
              <tr>
                <th>Período</th>
                <th>Pedidos</th>
                <th>GMV</th>
                <th>Receita</th>
              </tr>
            </thead>
            <tbody>
              {monthly.results.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{row.orders}</td>
                  <td>{money(row.gmv)}</td>
                  <td>{money(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="surface-card admin-table-card">
          <header>
            <div>
              <h2>Pedidos por situação</h2>
              <p>Distribuição operacional.</p>
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Pedidos</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {statuses.results.map((row) => (
                <tr key={row.status}>
                  <td>
                    <span className={`status-pill status-${row.status}`}>
                      {row.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>{row.total}</td>
                  <td>{money(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="surface-card admin-table-card">
          <header>
            <div>
              <h2>Saúde do catálogo</h2>
              <p>Produtos e posição física.</p>
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Produtos</th>
                <th>Estoque</th>
              </tr>
            </thead>
            <tbody>
              {catalog.results.map((row) => (
                <tr key={row.status}>
                  <td>{row.status}</td>
                  <td>{row.products}</td>
                  <td>{row.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="surface-card admin-table-card">
          <header>
            <div>
              <h2>Base de contas</h2>
              <p>Fornecedores e revendedores.</p>
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {organizations.results.map((row, index) => (
                <tr key={index}>
                  <td>{row.type}</td>
                  <td>{row.status}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
