import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { notFound, redirect } from 'next/navigation';
import { EditProductForm } from './edit-product-form';
import { ProductMediaManager } from './product-media-manager';
export const dynamic = 'force-dynamic';
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuthenticatedUser(`/produtos/${id}`);
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'supplier') redirect('/catalogo');
  const [product,variants,media] = await Promise.all([getD1()
    .prepare(
      `SELECT p.title,p.description,p.short_description shortDescription,p.brand,p.gtin,p.ncm,p.net_weight_grams netWeightGrams,p.gross_weight_grams grossWeightGrams,p.product_height_mm productHeightMm,p.product_width_mm productWidthMm,p.product_length_mm productLengthMm,p.package_height_mm packageHeightMm,p.package_width_mm packageWidthMm,p.package_length_mm packageLengthMm,p.composition,p.voltage,p.status,p.quality_score qualityScore,o.price_cents priceCents,o.suggested_retail_cents retailCents,o.preparation_days preparationDays FROM products p JOIN supplier_offers o ON o.product_id=p.id WHERE p.id=? AND p.organization_id=?`,
    )
    .bind(id, account.organization.id)
    .first<{
      title: string;
      description: string;
      shortDescription: string | null;
      brand: string | null;
      gtin: string | null;
      ncm: string | null;
      netWeightGrams:number|null;grossWeightGrams:number|null;productHeightMm:number|null;productWidthMm:number|null;productLengthMm:number|null;packageHeightMm:number|null;packageWidthMm:number|null;packageLengthMm:number|null;composition:string|null;voltage:string|null;
      status: string;
      qualityScore: number;
      priceCents: number;
      retailCents: number | null;
      preparationDays: number;
    }>(),getD1().prepare(`SELECT id,sku,name,gtin,attributes_json attributesJson,price_cents priceCents,suggested_retail_cents retailCents,stock FROM product_variants WHERE product_id=? AND status='active' ORDER BY created_at`).bind(id).all<{id:string;sku:string;name:string;gtin:string|null;attributesJson:string;priceCents:number;retailCents:number|null;stock:number}>(),getD1().prepare(`SELECT id,alt_text altText,sort_order sortOrder FROM product_media WHERE product_id=? ORDER BY sort_order`).bind(id).all<{id:string;altText:string;sortOrder:number}>()]);
  if (!product) notFound();
  return (
    <AppShell account={account} activePath="/produtos">
      <section className="page-heading">
        <div><span className="page-kicker">
          {product.status} · qualidade {product.qualityScore}/100
        </span>
        <h1>Editar produto</h1>
        <p>
          Alterações elegíveis são publicadas automaticamente e o histórico de
          preço é preservado.
        </p></div><a className="secondary-action" href="/produtos">Voltar aos produtos</a>
      </section>
      <section className="surface-card"><ProductMediaManager productId={id} media={media.results}/><EditProductForm id={id} product={product} variants={variants.results.map(item=>({...item,attributes:JSON.parse(item.attributesJson||'{}') as Record<string,string>}))} /></section>
    </AppShell>
  );
}
