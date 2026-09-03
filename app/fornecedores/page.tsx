import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { ArrowRight, Building2, PackageSearch, Star } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FollowSupplierButton } from './follow-supplier-button';

export const dynamic = 'force-dynamic';

export default async function SuppliersDirectory({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireAuthenticatedUser('/fornecedores');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/dashboard');
  const filters = await searchParams;
  const query = filters.q?.trim() ?? '';
  const category = filters.categoria ?? '';
  const [suppliers, categories] = await Promise.all([
    getD1()
      .prepare(
        `SELECT o.id,o.display_name displayName,sp.reputation_basis_points reputation,
          COUNT(DISTINCT p.id) productCount,
          COALESCE(MIN(so.price_cents),0) minPrice,
          STRING_AGG(DISTINCT c.name, ', ' ORDER BY c.name) categories,
          CASE WHEN sf.supplier_organization_id IS NULL THEN 0 ELSE 1 END following,
          (SELECT COUNT(*) FROM supplier_followers followers WHERE followers.supplier_organization_id=o.id) followerCount
         FROM organizations o
         JOIN supplier_profiles sp ON sp.organization_id=o.id
         JOIN subscriptions sub ON sub.organization_id=o.id AND sub.status IN ('active','grace_period')
         JOIN products p ON p.organization_id=o.id AND p.status='approved'
         JOIN supplier_offers so ON so.product_id=p.id
         LEFT JOIN categories c ON c.id=p.category_id
         LEFT JOIN supplier_followers sf ON sf.supplier_organization_id=o.id AND sf.reseller_organization_id=?
         WHERE o.type='supplier' AND o.status='active'
           AND (?='' OR o.display_name ILIKE ? OR EXISTS (SELECT 1 FROM products search_product WHERE search_product.organization_id=o.id AND search_product.status='approved' AND (search_product.title ILIKE ? OR search_product.description ILIKE ? OR search_product.brand ILIKE ? OR search_product.sku ILIKE ?)))
           AND (?='' OR EXISTS (SELECT 1 FROM products category_product WHERE category_product.organization_id=o.id AND category_product.status='approved' AND category_product.category_id=?))
         GROUP BY o.id,sp.reputation_basis_points,sf.supplier_organization_id
         ORDER BY following DESC,sp.reputation_basis_points DESC,o.display_name`,
      )
      .bind(
        account.organization.id,
        query,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        category,
        category,
      )
      .all<{
        id: string;
        displayName: string;
        reputation: number;
        productCount: number;
        minPrice: number;
        categories: string | null;
        following: number;
        followerCount: number;
      }>(),
    getD1()
      .prepare(
        `SELECT DISTINCT c.id,c.name FROM categories c JOIN products p ON p.category_id=c.id JOIN organizations o ON o.id=p.organization_id AND o.type='supplier' AND o.status='active' WHERE c.status='active' AND p.status='approved' ORDER BY c.name`,
      )
      .all<{ id: string; name: string }>(),
  ]);
  return (
    <AppShell account={account} activePath="/fornecedores">
      <section className="page-heading marketplace-heading">
        <div>
          <span className="page-kicker">
            <PackageSearch /> Central de fornecedores
          </span>
          <h1>Encontre produtos para vender</h1>
          <p>
            Pesquise o produto e descubra imediatamente quais fornecedores
            possuem estoque, preço e reputação adequados.
          </p>
        </div>
      </section>
      <form className="supplier-search-panel">
        <label>
          <span>Produto, marca, SKU ou fornecedor</span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Ex.: garrafa térmica, Órbita, ORB-GAR…"
          />
        </label>
        <label>
          <span>Categoria</span>
          <select name="categoria" defaultValue={category}>
            <option value="">Todas as categorias</option>
            {categories.results.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button>Buscar fornecedores</button>
        {(query || category) && (
          <Link href="/fornecedores">Limpar filtros</Link>
        )}
      </form>
      <div className="directory-result-bar">
        <strong>{suppliers.results.length} fornecedores encontrados</strong>
        <span>Ordenados por vínculo e reputação</span>
      </div>
      <section className="supplier-directory-grid">
        {suppliers.results.map((supplier) => (
          <article className="supplier-directory-card" key={supplier.id}>
            <header>
              <span className="supplier-monogram">
                <Building2 />
              </span>
              <div>
                <h2>{supplier.displayName}</h2>
                <p>
                  <Star /> {(supplier.reputation / 100).toFixed(1)}% de
                  reputação
                </p>
              </div>
            </header>
            <p className="supplier-categories">
              {supplier.categories ?? 'Catálogo geral'}
            </p>
            <dl>
              <div>
                <dt>Produtos ativos</dt>
                <dd>{supplier.productCount}</dd>
              </div>
              <div>
                <dt>A partir de</dt>
                <dd>
                  {(supplier.minPrice / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </dd>
              </div>
              <div>
                <dt>Revendedores seguindo</dt>
                <dd>{supplier.followerCount}</dd>
              </div>
            </dl>
            <footer>
              <FollowSupplierButton
                supplierId={supplier.id}
                initial={Boolean(supplier.following)}
              />
              <Link href={`/fornecedores/${supplier.id}`}>
                Ver catálogo <ArrowRight />
              </Link>
            </footer>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
