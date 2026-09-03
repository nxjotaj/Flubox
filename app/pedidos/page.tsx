import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import {
  AdminSectionWorkspace,
  type AdminWorkspaceRow,
} from '@/components/admin-section-workspace';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { AppShell } from '@/components/app-shell';

export const dynamic = 'force-dynamic';
export default async function OrdersPage() {
  const user = await requireAuthenticatedUser('/pedidos');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const supplier = account.organization.type === 'supplier';
  const orders = await getD1()
    .prepare(
      `SELECT o.id,o.number,o.status,o.total_cents totalCents,o.channel,o.created_at createdAt,org.display_name counterpart FROM orders o JOIN organizations org ON org.id=${supplier ? 'o.reseller_organization_id' : 'o.supplier_organization_id'} WHERE o.${supplier ? 'supplier_organization_id' : 'reseller_organization_id'}=? ORDER BY o.created_at DESC`,
    )
    .bind(account.organization.id)
    .all<{
      id: string;
      number: string;
      status: string;
      totalCents: number;
      channel: string;
      createdAt: string;
      counterpart: string;
    }>();
  return (
    <AppShell account={account} activePath="/pedidos">
        <section className="page-heading">
          <div>
            <span className="page-kicker">
              <ShoppingCart /> Operação rastreável
            </span>
            <h1>Pedidos</h1>
            <p>
              {supplier
                ? 'Priorize preparação, documentos e prazos de postagem.'
                : 'Acompanhe pagamento, documentos, envio e entrega.'}
            </p>
          </div>
        </section>
        <AdminSectionWorkspace
          section="pedidos"
          detailBase="/pedidos"
          columns={[
            ['number', 'Pedido'],
            ['status', 'Status'],
            ['channel', 'Canal'],
            ['counterpart', supplier ? 'Revendedor' : 'Fornecedor'],
            ['total', 'Valor'],
            ['createdAt', 'Criado em'],
          ]}
          rows={orders.results.map(
            (order): AdminWorkspaceRow => ({
              key: order.id,
              id: order.id,
              status: order.status,
              searchText: `${order.number} ${order.status} ${order.channel} ${order.counterpart}`,
              cells: {
                number: order.number,
                status: order.status.replaceAll('_', ' '),
                channel: order.channel.replaceAll('_', ' '),
                counterpart: order.counterpart,
                total: (Number(order.totalCents) / 100).toLocaleString(
                  'pt-BR',
                  { style: 'currency', currency: 'BRL' },
                ),
                createdAt: new Date(order.createdAt).toLocaleString('pt-BR'),
              },
            }),
          )}
        />
    </AppShell>
  );
}
