import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { MapPin, PackageCheck, Truck } from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function TrackingPage() {
  const user = await requireAuthenticatedUser('/rastreamento');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/dashboard');
  const rows = await getD1()
    .prepare(
      `SELECT o.id,o.number,o.status,s.carrier,s.tracking_code trackingCode,s.shipped_at shippedAt,s.delivered_at deliveredAt,org.display_name supplier FROM orders o JOIN organizations org ON org.id=o.supplier_organization_id LEFT JOIN shipments s ON s.order_id=o.id WHERE o.reseller_organization_id=? ORDER BY o.created_at DESC`,
    )
    .bind(account.organization.id)
    .all<{
      id: string;
      number: string;
      status: string;
      carrier: string | null;
      trackingCode: string | null;
      shippedAt: string | null;
      deliveredAt: string | null;
      supplier: string;
    }>();
  return (
    <AppShell account={account} activePath="/rastreamento">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <MapPin /> Acompanhamento
          </span>
          <h1>Rastreamento</h1>
          <p>Veja a situação dos pedidos enviados aos seus clientes.</p>
        </div>
      </section>
      <div className="shipment-board">
        {rows.results.length ? (
          rows.results.map((row) => (
            <article className="shipment-card" key={row.id}>
              <header>
                <div>
                  <span>{row.number}</span>
                  <strong>{row.supplier}</strong>
                </div>
                <span className={`status-pill status-${row.status}`}>
                  {row.status.replaceAll('_', ' ')}
                </span>
              </header>
              <div className="tracking-progress">
                <i className="done" />
                <i className={row.shippedAt ? 'done' : ''} />
                <i className={row.deliveredAt ? 'done' : ''} />
              </div>
              <div className="shipment-meta">
                <span>
                  <PackageCheck /> Pedido confirmado
                </span>
                <span>
                  <Truck />{' '}
                  {row.trackingCode
                    ? `${row.carrier} · ${row.trackingCode}`
                    : 'Preparação pelo fornecedor'}
                </span>
              </div>
              <footer>
                <a href={`/pedidos/${row.id}`}>Ver linha do tempo</a>
              </footer>
            </article>
          ))
        ) : (
          <div className="empty-state surface-card">
            <Truck />
            <strong>Nenhum pedido para rastrear</strong>
            <p>Pedidos enviados aparecerão aqui.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
