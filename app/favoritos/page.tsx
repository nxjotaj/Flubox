import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { FavoriteButton } from '../catalogo/catalog-actions';

export const dynamic = 'force-dynamic';
export default async function FavoritesPage() {
  const user = await requireAuthenticatedUser('/favoritos');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/produtos');
  const products = await getD1()
    .prepare(
      `SELECT p.id,p.title,o.price_cents priceCents,org.display_name supplier FROM product_favorites f JOIN products p ON p.id=f.product_id AND p.status='approved' JOIN supplier_offers o ON o.product_id=p.id JOIN organizations org ON org.id=p.organization_id AND org.status='active' JOIN subscriptions sub ON sub.organization_id=org.id AND sub.status IN ('active','grace_period') WHERE f.organization_id=? ORDER BY f.created_at DESC`,
    )
    .bind(account.organization.id)
    .all<{ id: string; title: string; priceCents: number; supplier: string }>();
  return (
    <main className="simple-app-page">
      <header>
        <a href="/dashboard">
          <BrandLogo />
        </a>
        <a href="/catalogo">Catálogo</a>
      </header>
      <section>
        <span className="eyebrow">Sua seleção</span>
        <h1>Favoritos</h1>
        <div className="product-list">
          {products.results.length === 0 ? (
            <div className="catalog-empty">
              Você ainda não favoritou produtos.
            </div>
          ) : (
            products.results.map((product) => (
              <article key={product.id}>
                <a href={`/catalogo/${product.id}`}>
                  <strong>{product.title}</strong>
                  <small>{product.supplier}</small>
                </a>
                <span>
                  {(product.priceCents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
                <FavoriteButton productId={product.id} initial />
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
