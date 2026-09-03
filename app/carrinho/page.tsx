import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { CheckoutForm } from '@/app/checkout/[productId]/checkout-form';
import { CartItemActions } from './cart-item-actions';
export const dynamic = 'force-dynamic';
export default async function CartPage() {
  const user = await requireAuthenticatedUser('/carrinho');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/produtos');
  const rows = await getD1()
    .prepare(
      `SELECT c.product_id productId,c.variant_id variantId,c.quantity,p.title,v.name variantName,COALESCE(v.price_cents,o.price_cents) priceCents,org.display_name supplier FROM cart_items c JOIN products p ON p.id=c.product_id AND p.status='approved' JOIN supplier_offers o ON o.product_id=p.id LEFT JOIN product_variants v ON v.id=c.variant_id JOIN organizations org ON org.id=p.organization_id AND org.status='active' JOIN subscriptions sub ON sub.organization_id=org.id AND sub.status IN ('active','grace_period') WHERE c.organization_id=? ORDER BY c.created_at`,
    )
    .bind(account.organization.id)
    .all<{
      productId: string;
      variantId: string | null;
      variantName: string | null;
      quantity: number;
      title: string;
      priceCents: number;
      supplier: string;
    }>();
  const total = rows.results.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );
  return (
    <AppShell account={account} activePath="/carrinho">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Pedido de fornecedor único</span>
          <h1>Carrinho</h1>
          <p>{rows.results[0]?.supplier ?? 'Selecione produtos no catálogo'}</p>
        </div>
      </section>
      {rows.results.length ? (
        <>
          <section className="surface-card cart-list">
            {rows.results.map((item) => (
              <article key={item.productId}>
                <div>
                  <strong>
                    {item.title}
                    {item.variantName ? ` · ${item.variantName}` : ''}
                  </strong>
                  <small>
                    {item.quantity} ×{' '}
                    {(item.priceCents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </small>
                </div>
                <b>
                  {((item.quantity * item.priceCents) / 100).toLocaleString(
                    'pt-BR',
                    { style: 'currency', currency: 'BRL' },
                  )}
                </b>
                <CartItemActions
                  productId={item.productId}
                  variantId={item.variantId}
                  quantity={item.quantity}
                />
              </article>
            ))}
            <footer>
              <span>Total</span>
              <strong>
                {(total / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>
            </footer>
          </section>
          <section className="surface-card cart-checkout">
            <h2>Destinatário e entrega</h2>
            <CheckoutForm
              items={rows.results.map((item) => ({
                productId: item.productId,
                variantId: item.variantId ?? undefined,
                quantity: item.quantity,
              }))}
            />
          </section>
        </>
      ) : (
        <section className="surface-card empty-state">
          <strong>Seu carrinho está vazio</strong>
          <p>Adicione produtos publicados por um fornecedor.</p>
          <a className="primary-action" href="/catalogo">
            Explorar catálogo
          </a>
        </section>
      )}
    </AppShell>
  );
}
