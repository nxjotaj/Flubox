import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { labelFor } from '@/lib/presentation';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { ProductForm } from './product-form';
import { ImportForm } from './import-form';
import { ProductActions } from './product-actions';
export const dynamic = 'force-dynamic';
export default async function ProductsPage() {
  const user = await requireAuthenticatedUser('/produtos');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'supplier') redirect('/catalogo');
  const [result, categoryRows] = await Promise.all([
    getD1()
      .prepare(
        `SELECT p.id,p.title,p.sku,p.status,p.quality_score AS qualityScore,o.price_cents AS priceCents,COALESCE((SELECT SUM(m.quantity) FROM inventory_movements m WHERE m.product_id=p.id),0) AS stock FROM products p JOIN supplier_offers o ON o.product_id=p.id WHERE p.organization_id=? ORDER BY p.created_at DESC`,
      )
      .bind(account.organization.id)
      .all<{
        id: string;
        title: string;
        sku: string;
        status: string;
        qualityScore: number;
        priceCents: number;
        stock: number;
      }>(),
    getD1()
      .prepare(
        `SELECT c.id,c.name,a.key,a.label,a.type,a.required,a.options_json optionsJson,a.unit FROM categories c LEFT JOIN category_attributes a ON a.category_id=c.id WHERE c.status='active' ORDER BY c.name,a.sort_order`,
      )
      .all<{
        id: string;
        name: string;
        key: string | null;
        label: string | null;
        type: string | null;
        required: boolean | null;
        optionsJson: string | null;
        unit: string | null;
      }>(),
  ]);
  const categories = Array.from(
    categoryRows.results.reduce((map, row) => {
      const category = map.get(row.id) ?? {
        id: row.id,
        name: row.name,
        attributes: [] as {
          key: string;
          label: string;
          type: string;
          required: boolean;
          options: string[];
          unit: string | null;
        }[],
      };
      if (row.key && row.label && row.type)
        category.attributes.push({
          key: row.key,
          label: row.label,
          type: row.type,
          required: Boolean(row.required),
          options: row.optionsJson
            ? (JSON.parse(row.optionsJson) as string[])
            : [],
          unit: row.unit,
        });
      map.set(row.id, category);
      return map;
    }, new Map<string, { id: string; name: string; attributes: { key: string; label: string; type: string; required: boolean; options: string[]; unit: string | null }[] }>()),
  ).map(([, category]) => category);
  return (
    <main className="simple-app-page">
      <header>
        <a href="/dashboard">
          <BrandLogo />
        </a>
        <a href="/dashboard">Voltar ao painel</a>
      </header>
      <section>
        <span className="eyebrow">Catálogo do fornecedor</span>
        <h1>Produtos</h1>
        <p>
          Cadastros incompletos permanecem em rascunho e todo estoque nasce de
          uma movimentação.
        </p>
        <ProductForm categories={categories} />
        <ImportForm />
        <div className="product-list">
          {result.results.length === 0 ? (
            <div className="catalog-empty">Nenhum produto cadastrado.</div>
          ) : (
            result.results.map((product) => (
              <article key={product.id}>
                <div>
                  <strong>{product.title}</strong>
                  <small>
                    {product.sku} · estoque {product.stock}
                  </small>
                </div>
                <span>
                  {(product.priceCents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
                <b>
                  {product.qualityScore}/100 · {labelFor(product.status)}
                </b>
                <ProductActions id={product.id} />
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
