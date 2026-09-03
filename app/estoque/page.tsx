import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { PackageSearch, TriangleAlert, Warehouse } from 'lucide-react';
import {
  AdminSectionWorkspace,
  type AdminWorkspaceRow,
} from '@/components/admin-section-workspace';
export const dynamic = 'force-dynamic';
export default async function StockPage() {
  const user = await requireAuthenticatedUser('/estoque');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'supplier') redirect('/dashboard');
  const rows = await getD1()
    .prepare(
      `SELECT p.id,p.title,p.sku,p.status,COALESCE(SUM(m.quantity),0) physical,COALESCE((SELECT SUM(r.quantity) FROM inventory_reservations r WHERE r.product_id=p.id AND r.status='active'),0) reserved FROM products p LEFT JOIN inventory_movements m ON m.product_id=p.id WHERE p.organization_id=? GROUP BY p.id ORDER BY p.title`,
    )
    .bind(account.organization.id)
    .all<{
      id: string;
      title: string;
      sku: string;
      status: string;
      physical: number;
      reserved: number;
    }>();
  const total = rows.results.reduce(
    (sum, row) => sum + Number(row.physical),
    0,
  );
  const low = rows.results.filter(
    (row) => Number(row.physical) - Number(row.reserved) <= 5,
  ).length;
  return (
    <AppShell account={account} activePath="/estoque">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <Warehouse /> Inventário
          </span>
          <h1>Controle de estoque</h1>
          <p>Posição física, reservas e disponibilidade por produto.</p>
        </div>
      </section>
      <section className="metric-grid">
        <article className="metric-card">
          <div>
            <span>Unidades físicas</span>
            <strong>{total}</strong>
            <small>Somatório registrado</small>
          </div>
          <i>
            <Warehouse />
          </i>
        </article>
        <article className="metric-card warning">
          <div>
            <span>Estoque baixo</span>
            <strong>{low}</strong>
            <small>Itens com até 5 unidades</small>
          </div>
          <i>
            <TriangleAlert />
          </i>
        </article>
        <article className="metric-card positive">
          <div>
            <span>SKUs ativos</span>
            <strong>{rows.results.length}</strong>
            <small>Produtos monitorados</small>
          </div>
          <i>
            <PackageSearch />
          </i>
        </article>
      </section>
      <AdminSectionWorkspace
        section="estoque"
        detailBase="/produtos"
        columns={[
          ['title', 'Produto'],
          ['sku', 'SKU'],
          ['physical', 'Físico'],
          ['reserved', 'Reservado'],
          ['available', 'Disponível'],
          ['status', 'Status'],
        ]}
        rows={rows.results.map((row): AdminWorkspaceRow => {
          const available = Number(row.physical) - Number(row.reserved);
          return {
            key: row.id,
            id: row.id,
            status: row.status,
            attention: available <= 5,
            searchText: `${row.title} ${row.sku} ${row.status}`,
            cells: {
              title: row.title,
              sku: row.sku,
              physical: String(row.physical),
              reserved: String(row.reserved),
              available: String(available),
              status: row.status.replaceAll('_', ' '),
            },
          };
        })}
      />
    </AppShell>
  );
}
