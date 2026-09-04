import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { getD1 } from '@/db';
import { channelLabel, labelFor } from '@/lib/presentation';
import { getAccountContext } from '@/modules/identity/service';
import { getSlaStatus } from '@/modules/logistics/sla';
import { notFound, redirect } from 'next/navigation';
import { LogisticsActions } from './logistics-actions';
import { PaymentPanel } from './payment-panel';
import { OrderDocumentsForm } from './order-documents-form';
import { AdminOrderControls } from './admin-order-controls';
export const dynamic = 'force-dynamic';
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuthenticatedUser(`/pedidos/${id}`);
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const order = await getD1()
    .prepare(
      `SELECT o.id,o.number,o.status,o.total_cents totalCents,o.channel,o.created_at createdAt,o.reseller_organization_id resellerId,o.supplier_organization_id supplierId,o.recipient_snapshot recipientSnapshot,o.address_snapshot addressSnapshot,o.notes,sup.display_name supplierName,res.display_name resellerName,s.carrier,s.tracking_code trackingCode,s.preparation_deadline deadline,s.status shipmentStatus,pi.pix_copy_paste pixCopyPaste,pi.expires_at paymentExpiresAt,pi.provider paymentProvider FROM orders o JOIN organizations sup ON sup.id=o.supplier_organization_id JOIN organizations res ON res.id=o.reseller_organization_id LEFT JOIN shipments s ON s.order_id=o.id LEFT JOIN payment_intents pi ON pi.order_id=o.id WHERE o.id=? AND (?=TRUE OR o.reseller_organization_id=? OR o.supplier_organization_id=?)`,
    )
    .bind(
      id,
      account.organization.type === 'platform',
      account.organization.id,
      account.organization.id,
    )
    .first<{
      id: string;
      number: string;
      status: string;
      totalCents: number;
      channel: string;
      createdAt: string;
      carrier: string | null;
      trackingCode: string | null;
      deadline: string | null;
      shipmentStatus: string | null;
      resellerId: string;
      supplierId: string;
      pixCopyPaste: string | null;
      paymentExpiresAt: string | null;
      paymentProvider: string | null;
      recipientSnapshot: string;
      addressSnapshot: string;
      notes: string | null;
      supplierName: string;
      resellerName: string;
    }>();
  if (!order) notFound();
  const [items, events, tracking, documents] = await Promise.all([
    getD1()
      .prepare(
        `SELECT product_snapshot snapshot,quantity,unit_price_cents unitPrice FROM order_items WHERE order_id=?`,
      )
      .bind(id)
      .all<{ snapshot: string; quantity: number; unitPrice: number }>(),
    getD1()
      .prepare(
        `SELECT type,from_status fromStatus,to_status toStatus,created_at createdAt FROM order_events WHERE order_id=? ORDER BY created_at DESC`,
      )
      .bind(id)
      .all<{
        type: string;
        fromStatus: string | null;
        toStatus: string | null;
        createdAt: string;
      }>(),
    getD1()
      .prepare(
        `SELECT t.status,t.description,t.location,t.occurred_at occurredAt FROM tracking_events t JOIN shipments s ON s.id=t.shipment_id WHERE s.order_id=? ORDER BY t.occurred_at DESC`,
      )
      .bind(id)
      .all<{
        status: string;
        description: string;
        location: string | null;
        occurredAt: string;
      }>(),
    getD1()
      .prepare(
        `SELECT id,type,file_name fileName,status,quantity_covered quantityCovered,barcode_value barcodeValue,created_at createdAt FROM order_documents WHERE order_id=? ORDER BY created_at`,
      )
      .bind(id)
      .all<{
        id: string;
        type: string;
        fileName: string;
        status: string;
        quantityCovered: number;
        barcodeValue: string | null;
        createdAt: string;
      }>(),
  ]);
  const isReseller = account.organization.id === order.resellerId;
  const hasLabel = documents.results.some(
    (document) => document.type === 'shipping_label',
  );
  const totalUnits = items.results.reduce(
    (sum, item) => sum + Number(item.quantity),
    0,
  );
  const coveredUnits = documents.results
    .filter((document) => document.type === 'shipping_label')
    .reduce((sum, document) => sum + Number(document.quantityCovered), 0);
  const hasFiscal = documents.results.some((document) =>
    ['nfe_danfe', 'content_declaration'].includes(document.type),
  );
  const recipient = JSON.parse(order.recipientSnapshot) as Record<
    string,
    string
  >;
  const address = JSON.parse(order.addressSnapshot) as Record<string, string>;
  return (
    <main className="simple-app-page">
      <header>
        <a href="/dashboard">
          <BrandLogo />
        </a>
        <a href="/pedidos">Todos os pedidos</a>
      </header>
      <section>
        <span className="eyebrow">{labelFor(order.status)}</span>
        <h1>{order.number}</h1>
        <p>
          {channelLabel(order.channel)} ·{' '}
          {(order.totalCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
        </p>
        {isReseller && order.status === 'awaiting_payment' && (
          <PaymentPanel
            orderId={id}
            copyPaste={order.pixCopyPaste}
            expiresAt={order.paymentExpiresAt}
            development={order.paymentProvider === 'development'}
          />
        )}
        {isReseller &&
          ['awaiting_payment', 'paid_awaiting_documents'].includes(
            order.status,
          ) && (
            <OrderDocumentsForm
              orderId={id}
              hasLabel={hasLabel && coveredUnits >= totalUnits}
              hasFiscal={hasFiscal}
              totalUnits={totalUnits}
              coveredUnits={coveredUnits}
            />
          )}
        {documents.results.length > 0 && (
          <section className="order-operation-card">
            <h2>Documentos do envio</h2>
            <div className="document-list">
              {documents.results.map((document) => (
                <a
                  key={document.id}
                  href={`/api/orders/${id}/documents/${document.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>
                    {document.type === 'shipping_label'
                      ? 'Etiqueta de envio'
                      : document.type === 'nfe_danfe'
                        ? 'NF-e / DANFE'
                        : 'Declaração de conteúdo'}
                  </strong>
                  <small>
                    {document.fileName}
                    {document.type === 'shipping_label'
                      ? ` · cobre ${document.quantityCovered} un.${document.barcodeValue ? ` · código ${document.barcodeValue}` : ''}`
                      : ''}{' '}
                    · {new Date(document.createdAt).toLocaleString('pt-BR')}
                  </small>
                </a>
              ))}
            </div>
          </section>
        )}
        {!isReseller && order.status === 'paid_awaiting_documents' && (
          <section className="order-operation-card">
            <h2>Aguardando documentos do revendedor</h2>
            <p>
              O PIX foi confirmado. A preparação será liberada quando a etiqueta
              e a nota ou declaração forem enviadas.
            </p>
          </section>
        )}
        {account.organization.type === 'supplier' && (
          <LogisticsActions orderId={id} status={order.status} />
        )}
        {account.organization.type === 'platform' && (
          <AdminOrderControls orderId={id} status={order.status} />
        )}
        <div className="order-detail-grid">
          <section>
            <h2>Itens</h2>
            {items.results.map((item, index) => {
              const snapshot = JSON.parse(item.snapshot) as {
                title: string;
                sku: string;
              };
              return (
                <article key={index}>
                  <strong>
                    {item.quantity}× {snapshot.title}
                  </strong>
                  <small>
                    {snapshot.sku} ·{' '}
                    {(item.unitPrice / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </small>
                </article>
              );
            })}
          </section>
          <section>
            <h2>Participantes e entrega</h2>
            <article>
              <strong>Fornecedor: {order.supplierName}</strong>
              <small>Revendedor: {order.resellerName}</small>
            </article>
            <article>
              <strong>{recipient.name}</strong>
              <small>
                {recipient.document} · {recipient.phone}
              </small>
            </article>
            <p>
              {address.street}, {address.number}
              {address.complement ? ` · ${address.complement}` : ''} ·{' '}
              {address.district} · {address.city}/{address.state} ·{' '}
              {address.postalCode}
            </p>
            {order.notes && (
              <p>
                <strong>Observação:</strong> {order.notes}
              </p>
            )}
          </section>
          <section>
            <h2>Envio</h2>
            {order.deadline ? (
              <>
                <p>Prazo: {new Date(order.deadline).toLocaleString('pt-BR')}</p>
                <b>{getSlaStatus(order.deadline, new Date().toISOString())}</b>
                <p>
                  {order.carrier} {order.trackingCode}
                </p>
              </>
            ) : (
              <p>Aguardando início da preparação.</p>
            )}
          </section>
        </div>
        <section className="order-timeline">
          <h2>Timeline</h2>
          {tracking.results.map((event, index) => (
            <article key={`t${index}`}>
              <time>{new Date(event.occurredAt).toLocaleString('pt-BR')}</time>
              <div>
                <strong>{event.description}</strong>
                <small>{event.location ?? labelFor(event.status)}</small>
              </div>
            </article>
          ))}
          {events.results.map((event, index) => (
            <article key={`e${index}`}>
              <time>{new Date(event.createdAt).toLocaleString('pt-BR')}</time>
              <div>
                <strong>{labelFor(event.type, 'Atualização do pedido')}</strong>
                <small>
                  {labelFor(event.fromStatus, 'Início')} →{' '}
                  {labelFor(event.toStatus, 'Atualização')}
                </small>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
