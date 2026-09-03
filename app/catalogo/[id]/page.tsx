import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { notFound, redirect } from 'next/navigation';
import { FavoriteButton, ListPicker } from '../catalog-actions';
import { VariantSelector } from './variant-selector';
import Image from 'next/image';

export const dynamic = 'force-dynamic';
type Detail = {
  id: string;
  title: string;
  description: string;
  brand: string | null;
  sku: string;
  supplier: string;
  reputation: number;
  priceCents: number;
  retailCents: number | null;
  commission: number;
  preparationDays: number;
  stock: number;
  favorited: number;
};
export default async function ProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuthenticatedUser(`/catalogo/${id}`);
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/produtos');
  const product = await getD1()
    .prepare(
      `SELECT * FROM (SELECT p.id,p.title,p.description,p.brand,p.sku,org.display_name supplier,sp.reputation_basis_points reputation,o.price_cents priceCents,o.suggested_retail_cents retailCents,o.commission_basis_points commission,o.preparation_days preparationDays,COALESCE((SELECT SUM(quantity) FROM inventory_movements WHERE product_id=p.id),0)-COALESCE((SELECT SUM(quantity) FROM inventory_reservations WHERE product_id=p.id AND status='active' AND expires_at>?),0) stock,CASE WHEN f.product_id IS NULL THEN 0 ELSE 1 END favorited FROM products p JOIN supplier_offers o ON o.product_id=p.id JOIN organizations org ON org.id=p.organization_id AND org.status='active' JOIN subscriptions sub ON sub.organization_id=org.id AND sub.status IN ('active','grace_period') JOIN supplier_profiles sp ON sp.organization_id=org.id LEFT JOIN product_favorites f ON f.product_id=p.id AND f.organization_id=? WHERE p.id=? AND p.status='approved') catalog WHERE stock>0`,
    )
    .bind(new Date().toISOString(), account.organization.id, id)
    .first<Detail>();
  if (!product) notFound();
  const [attributes, lists, variants, media] = await Promise.all([
    getD1()
      .prepare(
        `SELECT a.label,v.value,a.unit FROM product_attribute_values v JOIN category_attributes a ON a.id=v.attribute_id WHERE v.product_id=? ORDER BY a.sort_order`,
      )
      .bind(id)
      .all<{ label: string; value: string; unit: string | null }>(),
    getD1()
      .prepare(
        'SELECT id,name FROM product_lists WHERE organization_id=? ORDER BY name',
      )
      .bind(account.organization.id)
      .all<{ id: string; name: string }>(),
    getD1()
      .prepare(
        `SELECT id,name,sku,price_cents priceCents,stock,attributes_json attributesJson FROM product_variants WHERE product_id=? AND status='active' ORDER BY name`,
      )
      .bind(id)
      .all<{
        id: string;
        name: string;
        sku: string;
        priceCents: number;
        stock: number;
        attributesJson: string;
      }>(),
    getD1()
      .prepare(
        `SELECT id,alt_text altText FROM product_media WHERE product_id=? ORDER BY sort_order LIMIT 10`,
      )
      .bind(id)
      .all<{ id: string; altText: string }>(),
  ]);
  return (
    <main className="catalog-page">
      <header>
        <a href="/dashboard">
          <BrandLogo />
        </a>
        <nav>
          <a href="/catalogo">Voltar ao catálogo</a>
        </nav>
      </header>
      <section className="product-detail">
        <div className="product-detail-visual">
          {media.results.length ? (
            <div className="product-gallery">
              {media.results.map((item) => (
                <Image
                  key={item.id}
                  src={`/api/products/${id}/media/${item.id}`}
                  alt={item.altText}
                  width={720}
                  height={720}
                  unoptimized
                />
              ))}
            </div>
          ) : (
            (product.brand?.slice(0, 1) ?? 'F')
          )}
        </div>
        <div>
          <span className="eyebrow">
            {product.brand ?? 'Produto selecionado'}
          </span>
          <h1>{product.title}</h1>
          <p>{product.description}</p>
          <div className="detail-price">
            <strong>
              {(product.priceCents / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
            {product.retailCents && (
              <span>
                Preço sugerido{' '}
                {(product.retailCents / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>
            )}
          </div>
          <dl>
            <div>
              <dt>Fornecedor</dt>
              <dd>{product.supplier}</dd>
            </div>
            <div>
              <dt>Reputação</dt>
              <dd>{(product.reputation / 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Preparação</dt>
              <dd>até {product.preparationDays} dia(s)</dd>
            </div>
            <div>
              <dt>Estoque</dt>
              <dd>{product.stock} unidade(s)</dd>
            </div>
            <div>
              <dt>Comissão</dt>
              <dd>{(product.commission / 100).toFixed(2)}%</dd>
            </div>
            <div>
              <dt>SKU</dt>
              <dd>{product.sku}</dd>
            </div>
          </dl>
          {attributes.results.length > 0 && (
            <section className="attributes">
              <h2>Características</h2>
              {attributes.results.map((item) => (
                <p key={item.label}>
                  <strong>{item.label}</strong>
                  <span>
                    {item.value}
                    {item.unit ? ` ${item.unit}` : ''}
                  </span>
                </p>
              ))}
            </section>
          )}
          <div className="detail-actions">
            {!variants.results.length && (
              <a className="primary-link" href={`/checkout/${id}`}>
                Criar pedido
              </a>
            )}
            <FavoriteButton
              productId={id}
              initial={Boolean(product.favorited)}
            />
            <ListPicker productId={id} lists={lists.results} />
          </div>
          {variants.results.length > 0 && (
            <VariantSelector
              productId={id}
              variants={variants.results.map((variant) => ({
                ...variant,
                attributes: JSON.parse(variant.attributesJson) as Record<
                  string,
                  string
                >,
              }))}
            />
          )}
        </div>
      </section>
    </main>
  );
}
