import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { ArrowLeft, Box, Building2, Heart, Star } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  AddToCartButton,
  FavoriteButton,
} from '@/app/catalogo/catalog-actions';
import { FollowSupplierButton } from '../follow-supplier-button';

export const dynamic = 'force-dynamic';

export default async function SupplierStore({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuthenticatedUser(`/fornecedores/${id}`);
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/dashboard');
  const supplier = await getD1()
    .prepare(
      `SELECT o.id,o.display_name displayName,sp.trade_name tradeName,sp.legal_name legalName,sp.cnpj,sp.responsible_email responsibleEmail,sp.responsible_phone responsiblePhone,sp.public_profile_enabled publicProfileEnabled,sp.reputation_basis_points reputation,CASE WHEN sf.supplier_organization_id IS NULL THEN 0 ELSE 1 END following,a.street,a.number,a.complement,a.district,a.city,a.state,a.postal_code postalCode FROM organizations o JOIN supplier_profiles sp ON sp.organization_id=o.id JOIN subscriptions s ON s.organization_id=o.id AND s.status IN ('active','grace_period') LEFT JOIN supplier_followers sf ON sf.supplier_organization_id=o.id AND sf.reseller_organization_id=? LEFT JOIN addresses a ON a.organization_id=o.id AND a.type='primary' WHERE o.id=? AND o.type='supplier' AND o.status='active'`,
    )
    .bind(account.organization.id, id)
    .first<{
      id: string;
      displayName: string;
      tradeName: string;
      reputation: number;
      following: number;
      legalName: string;
      cnpj: string;
      responsibleEmail: string;
      responsiblePhone: string;
      publicProfileEnabled: boolean;
      street: string | null;
      number: string | null;
      complement: string | null;
      district: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
    }>();
  if (!supplier) notFound();
  const products = await getD1()
    .prepare(
      `SELECT p.id,p.title,p.brand,p.sku,c.name category,so.price_cents priceCents,so.suggested_retail_cents retailCents,COALESCE(SUM(im.quantity),0)-COALESCE((SELECT SUM(ir.quantity) FROM inventory_reservations ir WHERE ir.product_id=p.id AND ir.status='active' AND ir.expires_at>?),0) stock,CASE WHEN pf.product_id IS NULL THEN 0 ELSE 1 END favorited FROM products p JOIN supplier_offers so ON so.product_id=p.id LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN inventory_movements im ON im.product_id=p.id LEFT JOIN product_favorites pf ON pf.product_id=p.id AND pf.organization_id=? WHERE p.organization_id=? AND p.status='approved' GROUP BY p.id,c.name,so.price_cents,so.suggested_retail_cents,pf.product_id ORDER BY p.title`,
    )
    .bind(new Date().toISOString(), account.organization.id, id)
    .all<{
      id: string;
      title: string;
      brand: string | null;
      sku: string;
      category: string | null;
      priceCents: number;
      retailCents: number | null;
      stock: number;
      favorited: number;
    }>();
  return (
    <AppShell account={account} activePath="/fornecedores">
      <Link className="back-link" href="/fornecedores">
        <ArrowLeft /> Todos os fornecedores
      </Link>
      <section className="supplier-store-hero">
        <span>
          <Building2 />
        </span>
        <div>
          <small>Fornecedor verificado</small>
          <h1>{supplier.displayName}</h1>
          <p>
            <Star /> {(supplier.reputation / 100).toFixed(1)}% de reputação ·{' '}
            {products.results.length} produtos disponíveis
          </p>
        </div>
        <FollowSupplierButton
          supplierId={id}
          initial={Boolean(supplier.following)}
        />
      </section>
      {supplier.publicProfileEnabled && (
        <section className="surface-card supplier-public-info">
          <h2>Dados comerciais do fornecedor</h2>
          <dl>
            <div>
              <dt>Razão social</dt>
              <dd>{supplier.legalName}</dd>
            </div>
            <div>
              <dt>CNPJ</dt>
              <dd>{supplier.cnpj}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>{supplier.responsiblePhone}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{supplier.responsibleEmail}</dd>
            </div>
            <div className="wide">
              <dt>Endereço</dt>
              <dd>
                {[
                  supplier.street,
                  supplier.number,
                  supplier.complement,
                  supplier.district,
                  supplier.city,
                  supplier.state,
                  supplier.postalCode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </dd>
            </div>
          </dl>
        </section>
      )}
      <section className="supplier-product-grid">
        {products.results.map((product) => (
          <article key={product.id}>
            <Link
              href={`/catalogo/${product.id}`}
              className="supplier-product-main"
            >
              <span className="product-image-placeholder">
                <Box />
              </span>
              <small>{product.category ?? product.brand ?? 'Produto'}</small>
              <h2>{product.title}</h2>
              <p>SKU {product.sku}</p>
              <strong>
                {(product.priceCents / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>
              <span className={product.stock <= 5 ? 'stock-critical' : ''}>
                {product.stock} unidades disponíveis
              </span>
            </Link>
            <div className="supplier-product-actions">
              <FavoriteButton
                productId={product.id}
                initial={Boolean(product.favorited)}
              />
              <AddToCartButton productId={product.id} />
            </div>
          </article>
        ))}
      </section>
      {!products.results.length && (
        <div className="empty-state surface-card">
          <Heart />
          <strong>Nenhum produto disponível</strong>
          <p>O catálogo deste fornecedor está temporariamente sem estoque.</p>
        </div>
      )}
    </AppShell>
  );
}
