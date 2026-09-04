import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { channelLabel } from '@/lib/presentation';
import { notFound, redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function PrintOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuthenticatedUser(`/pedidos/${id}/imprimir`);
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const order = await getD1()
    .prepare(
      `SELECT o.number,o.status,o.channel,o.external_reference externalReference,o.recipient_snapshot recipient,o.address_snapshot address,o.total_cents totalCents,o.created_at createdAt,s.display_name supplier,r.display_name reseller FROM orders o JOIN organizations s ON s.id=o.supplier_organization_id JOIN organizations r ON r.id=o.reseller_organization_id WHERE o.id=? AND (?=TRUE OR o.supplier_organization_id=? OR o.reseller_organization_id=?)`,
    )
    .bind(
      id,
      account.organization.type === 'platform',
      account.organization.id,
      account.organization.id,
    )
    .first<{
      number: string;
      status: string;
      channel: string;
      externalReference: string | null;
      recipient: string;
      address: string;
      totalCents: number;
      createdAt: string;
      supplier: string;
      reseller: string;
    }>();
  if (!order) notFound();
  const items = await getD1()
    .prepare(
      'SELECT product_snapshot snapshot,quantity,unit_price_cents unitPrice,subtotal_cents subtotal FROM order_items WHERE order_id=?',
    )
    .bind(id)
    .all<{
      snapshot: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>();
  const recipient = JSON.parse(order.recipient);
  const address = JSON.parse(order.address);
  return (
    <main className="print-document">
      <header>
        <BrandLogo />
        <div>
          <strong>Documento operacional do pedido</strong>
          <span>{order.number}</span>
        </div>
      </header>
      <section className="print-grid">
        <div>
          <small>Fornecedor</small>
          <strong>{order.supplier}</strong>
        </div>
        <div>
          <small>Revendedor</small>
          <strong>{order.reseller}</strong>
        </div>
        <div>
          <small>Canal de origem</small>
          <strong>{channelLabel(order.channel)}</strong>
        </div>
        <div>
          <small>Referência externa</small>
          <strong>{order.externalReference ?? 'Não informada'}</strong>
        </div>
      </section>
      <h2>Destinatário</h2>
      <section className="recipient-label">
        <strong>{recipient.name}</strong>
        <span>
          {address.street}, {address.number}
        </span>
        <span>
          {address.district} · {address.city}/{address.state}
        </span>
        <b>CEP {address.postalCode}</b>
      </section>
      <h2>Itens</h2>
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd.</th>
            <th>Unitário</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.results.map((item, index) => {
            const snapshot = JSON.parse(item.snapshot);
            return (
              <tr key={index}>
                <td>
                  <strong>{snapshot.title}</strong>
                  <small>{snapshot.sku}</small>
                </td>
                <td>{item.quantity}</td>
                <td>
                  {(item.unitPrice / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </td>
                <td>
                  {(item.subtotal / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <footer>
        <span>Emitido em {new Date().toLocaleString('pt-BR')}</span>
        <strong>
          Total:{' '}
          {(order.totalCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
        </strong>
      </footer>
      <p className="print-button">Use Ctrl+P para imprimir ou salvar em PDF</p>
    </main>
  );
}
