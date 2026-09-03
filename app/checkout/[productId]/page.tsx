import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { notFound, redirect } from 'next/navigation';
import { CheckoutForm } from './checkout-form';
export const dynamic = 'force-dynamic';
export default async function Checkout({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { productId } = await params;
  const { variant: variantId } = await searchParams;
  const user = await requireAuthenticatedUser(`/checkout/${productId}`);
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'reseller') redirect('/produtos');
  const product = await getD1()
    .prepare(
      `SELECT p.title,COALESCE(v.price_cents,o.price_cents) priceCents,v.name variantName,org.display_name supplier FROM products p JOIN supplier_offers o ON o.product_id=p.id JOIN organizations org ON org.id=p.organization_id AND org.status='active' JOIN subscriptions sub ON sub.organization_id=org.id AND sub.status IN ('active','grace_period') LEFT JOIN product_variants v ON v.id=? AND v.product_id=p.id AND v.status='active' WHERE p.id=? AND p.status='approved' AND (? IS NULL OR v.id IS NOT NULL)`,
    )
    .bind(variantId??null,productId,variantId??null)
    .first<{ title: string; priceCents: number; variantName:string|null; supplier: string }>();
  if (!product) notFound();
  return (
    <main className="simple-app-page">
      <header>
        <a href="/dashboard">
          <BrandLogo />
        </a>
        <a href={`/catalogo/${productId}`}>Voltar ao produto</a>
      </header>
      <section>
        <span className="eyebrow">Checkout de fornecedor único</span>
        <h1>Criar pedido</h1>
        <p>
          {product.title}{product.variantName?` · ${product.variantName}`:''} · {product.supplier} ·{' '}
          {(product.priceCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
        </p>
        <CheckoutForm productId={productId} variantId={variantId} />
      </section>
    </main>
  );
}
