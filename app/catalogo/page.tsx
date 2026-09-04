import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { AddToCartButton, FavoriteButton } from './catalog-actions';

export const dynamic = 'force-dynamic';
type ProductRow = {
  id: string;
  title: string;
  brand: string | null;
  supplier: string;
  category: string | null;
  priceCents: number;
  retailCents: number | null;
  stock: number;
  favorited: number;
  reputation: number;
  preparationDays: number;
};
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAuthenticatedUser('/catalogo');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/produtos');
  const filters = await searchParams;
  const q = filters.q?.trim() ?? '';
  const category = filters.categoria ?? '';
  const supplier = filters.fornecedor ?? '';
  const minPrice = Math.max(
    0,
    Math.round(Number(filters.precoMin?.replace(',', '.') || 0) * 100),
  );
  const maxPrice = Math.max(
    0,
    Math.round(Number(filters.precoMax?.replace(',', '.') || 0) * 100),
  );
  const maxSla = Math.max(0, Number(filters.sla ?? 0));
  const page = Math.max(1, Number(filters.pagina ?? 1));
  const order =
    filters.ordem === 'maior-preco'
      ? 'o.price_cents DESC'
      : filters.ordem === 'menor-preco'
        ? 'o.price_cents ASC'
        : 'p.created_at DESC';
  const [result, categories, suppliers] = await Promise.all([
    getD1()
      .prepare(
        `SELECT * FROM (SELECT p.id,p.title,p.brand,p.created_at createdAt,org.display_name supplier,c.name category,o.price_cents priceCents,o.suggested_retail_cents retailCents,sp.reputation_basis_points reputation,o.preparation_days preparationDays,COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id=p.id),0)-COALESCE((SELECT SUM(quantity) FROM inventory_reservations WHERE product_id=p.id AND status='active' AND expires_at>?),0) stock,CASE WHEN f.product_id IS NULL THEN 0 ELSE 1 END favorited FROM products p JOIN supplier_offers o ON o.product_id=p.id JOIN organizations org ON org.id=p.organization_id AND org.status='active' JOIN subscriptions sub ON sub.organization_id=org.id AND sub.status IN ('active','grace_period') JOIN supplier_profiles sp ON sp.organization_id=org.id LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN product_favorites f ON f.product_id=p.id AND f.organization_id=? WHERE p.status='approved' AND (?='' OR p.title ILIKE ? OR p.sku ILIKE ? OR p.gtin ILIKE ? OR p.description ILIKE ? OR p.brand ILIKE ? OR c.name ILIKE ? OR org.display_name ILIKE ?) AND (?='' OR p.category_id=?) AND (?='' OR p.organization_id=?) AND (?=0 OR o.price_cents>=?) AND (?=0 OR o.price_cents<=?) AND (?=0 OR o.preparation_days<=?)) catalog WHERE stock>0 ORDER BY ${order.replaceAll('o.price_cents', 'priceCents').replaceAll('p.created_at', 'createdAt')} LIMIT 24 OFFSET ?`,
      )
      .bind(
        new Date().toISOString(),
        account.organization.id,
        q,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`,
        category,
        category,
        supplier,
        supplier,
        minPrice,
        minPrice,
        maxPrice,
        maxPrice,
        maxSla,
        maxSla,
        (page - 1) * 24,
      )
      .all<ProductRow>(),
    getD1()
      .prepare(
        `SELECT id,name FROM categories WHERE status='active' ORDER BY name`,
      )
      .all<{ id: string; name: string }>(),
    getD1()
      .prepare(
        `SELECT id,display_name name FROM organizations WHERE type='supplier' AND status='active' ORDER BY display_name`,
      )
      .all<{ id: string; name: string }>(),
  ]);
  return (
    <main className="catalog-page">
      <header>
        <a href="/dashboard">
          <BrandLogo />
        </a>
        <nav>
          <a href="/favoritos">Favoritos</a>
          <a href="/listas">Minhas listas</a>
          <a href="/dashboard">Painel</a>
        </nav>
      </header>
      <section className="catalog-hero">
        <span className="eyebrow">Ofertas publicadas automaticamente</span>
        <h1>Catálogo</h1>
        <p>Ofertas reais, com estoque disponível e fornecedores ativos.</p>
        <form>
          <input
            name="q"
            defaultValue={q}
            placeholder="Nome, SKU, GTIN, marca, categoria ou fornecedor"
          />
          <select name="categoria" defaultValue={category}>
            <option value="">Todas as categorias</option>
            {categories.results.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select name="fornecedor" defaultValue={supplier}>
            <option value="">Todos os fornecedores</option>
            {suppliers.results.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input
            name="precoMin"
            defaultValue={filters.precoMin}
            inputMode="decimal"
            placeholder="Preço mínimo"
          />
          <input
            name="precoMax"
            defaultValue={filters.precoMax}
            inputMode="decimal"
            placeholder="Preço máximo"
          />
          <select name="sla" defaultValue={filters.sla}>
            <option value="0">Qualquer prazo</option>
            <option value="1">Até 1 dia</option>
            <option value="2">Até 2 dias</option>
            <option value="3">Até 3 dias</option>
          </select>
          <select name="ordem" defaultValue={filters.ordem}>
            <option value="recentes">Mais recentes</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
          </select>
          <button>Buscar</button>
        </form>
      </section>
      <section className="catalog-grid">
        {result.results.length === 0 ? (
          <div className="catalog-empty">
            <h2>Nenhum produto encontrado</h2>
            <p>A busca considera somente itens aprovados e com estoque.</p>
          </div>
        ) : (
          result.results.map((product) => (
            <article key={product.id}>
              <a href={`/catalogo/${product.id}`}>
                <div className="catalog-placeholder">
                  {product.brand?.slice(0, 1) ?? 'F'}
                </div>
                <small>{product.category ?? 'Sem categoria'}</small>
                <h2>{product.title}</h2>
                <p>por {product.supplier}</p>
                <p>
                  {(product.reputation / 100).toFixed(1)}% de reputação ·
                  postagem em até {product.preparationDays} dia(s)
                </p>
                <strong>
                  {(product.priceCents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </strong>
                {product.retailCents && (
                  <span>
                    Sugerido:{' '}
                    {(product.retailCents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                )}
              </a>
              <FavoriteButton
                productId={product.id}
                initial={Boolean(product.favorited)}
              />
              <a
                className="catalog-action"
                href={`/integracoes?produto=${product.id}`}
              >
                Anunciar em marketplace
              </a>
              <AddToCartButton productId={product.id} />
            </article>
          ))
        )}
      </section>
      <nav className="catalog-pagination" aria-label="Paginação do catálogo">
        {page > 1 && (
          <a
            href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), pagina: String(page - 1) } as Record<string, string>)}`}
          >
            Página anterior
          </a>
        )}{' '}
        {result.results.length === 24 && (
          <a
            href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), pagina: String(page + 1) } as Record<string, string>)}`}
          >
            Próxima página
          </a>
        )}
      </nav>
    </main>
  );
}
