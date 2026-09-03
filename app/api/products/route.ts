import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { requestIdFrom, logError } from '@/lib/request-context';
import {
  calculateProductQuality,
  canSubmitForReview,
} from '@/modules/catalog/quality';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';
const schema = z.object({
  sku: z.string().trim().min(1).max(64),
  title: z.string().trim().min(5).max(180),
  description: z.string().trim().min(10).max(10000),
  shortDescription: z.string().trim().min(20).max(280),
  brand: z.string().trim().max(100).optional(),
  gtin: z.string().trim().max(14).optional(),
  ncm: z.string().trim().max(8).optional(),
  netWeightGrams: z.int().positive().optional(),
  grossWeightGrams: z.int().positive(),
  productHeightMm: z.int().positive().optional(),
  productWidthMm: z.int().positive().optional(),
  productLengthMm: z.int().positive().optional(),
  packageHeightMm: z.int().positive(),
  packageWidthMm: z.int().positive(),
  packageLengthMm: z.int().positive(),
  composition: z.string().trim().max(1000).optional(),
  voltage: z.string().trim().max(30).optional(),
  categoryId: z.string().optional(),
  attributes: z.record(z.string(), z.string().max(500)).default({}),
  priceCents: z.int().positive(),
  suggestedRetailCents: z.int().positive().optional(),
  stock: z.int().nonnegative(),
  preparationDays: z.int().min(1).max(30),
  variants: z.array(z.object({name:z.string().trim().min(1).max(100),sku:z.string().trim().min(1).max(64),gtin:z.string().trim().max(14).optional(),attributes:z.record(z.string(),z.string().max(100)),priceCents:z.int().positive(),suggestedRetailCents:z.int().positive().optional(),stock:z.int().nonnegative()})).max(100).default([]),
});
export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthenticatedUser();
    if (!user)
      return Response.json(
        { error: 'Faça login.', requestId },
        { status: 401 },
      );
    const account = await requireAccountPermission(user, 'products.manage');
    if (account.organization.type !== 'supplier')
      return Response.json(
        { error: 'Apenas fornecedores cadastram produtos.', requestId },
        { status: 403 },
      );
    if (account.organization.status !== 'active')
      return Response.json(
        {
          error:
            'Seu fornecedor precisa ser aprovado antes de publicar produtos.',
          requestId,
        },
        { status: 403 },
      );
    const subscription = await getD1()
      .prepare('SELECT status FROM subscriptions WHERE organization_id=?')
      .bind(account.organization.id)
      .first<{ status: string }>();
    if (
      !subscription ||
      !['active', 'grace_period'].includes(subscription.status)
    )
      return Response.json(
        { error: 'Regularize a assinatura para publicar produtos.', requestId },
        { status: 403 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Revise os dados.',
          requestId,
        },
        { status: 422 },
      );
    const input = parsed.data;
    const categoryAttributes = input.categoryId
      ? await getD1()
          .prepare(
            `SELECT id,key,required,options_json AS optionsJson FROM category_attributes WHERE category_id=? ORDER BY sort_order`,
          )
          .bind(input.categoryId)
          .all<{
            id: string;
            key: string;
            required: number;
            optionsJson: string | null;
          }>()
      : { results: [] };
    const missingAttribute = categoryAttributes.results.find(
      (attribute) =>
        attribute.required && !input.attributes[attribute.key]?.trim(),
    );
    if (missingAttribute)
      return Response.json(
        {
          error: `O atributo obrigatório “${missingAttribute.key}” não foi informado.`,
          requestId,
        },
        { status: 422 },
      );
    const qualityScore = calculateProductQuality({
      ...input,
      categoryId: input.categoryId,
    });
    const totalStock=input.variants.length?input.variants.reduce((sum,variant)=>sum+variant.stock,0):input.stock;
    const basePrice=input.variants.length?Math.min(...input.variants.map(variant=>variant.priceCents)):input.priceCents;
    // Produtos elegíveis são publicados automaticamente. A administração
    // modera exceções, mas não integra uma fila obrigatória de aprovação.
    const status = canSubmitForReview(qualityScore) ? 'approved' : 'draft';
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const d1 = getD1();
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO products (id,organization_id,category_id,sku,title,description,short_description,brand,gtin,ncm,net_weight_grams,gross_weight_grams,product_height_mm,product_width_mm,product_length_mm,package_height_mm,package_width_mm,package_length_mm,composition,voltage,status,quality_score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          id,
          account.organization.id,
          input.categoryId ?? null,
          input.sku,
          input.title,
          input.description,
          input.shortDescription,
          input.brand ?? null,
          input.gtin ?? null,
          input.ncm ?? null,
          input.netWeightGrams ?? null,
          input.grossWeightGrams,
          input.productHeightMm ?? null,
          input.productWidthMm ?? null,
          input.productLengthMm ?? null,
          input.packageHeightMm,
          input.packageWidthMm,
          input.packageLengthMm,
          input.composition ?? null,
          input.voltage ?? null,
          status,
          qualityScore,
          now,
          now,
        ),
      ...categoryAttributes.results
        .filter((attribute) => input.attributes[attribute.key]?.trim())
        .map((attribute) =>
          d1
            .prepare(
              `INSERT INTO product_attribute_values (product_id,attribute_id,value) VALUES (?,?,?)`,
            )
            .bind(id, attribute.id, input.attributes[attribute.key].trim()),
        ),
      d1
        .prepare(
          `INSERT INTO supplier_offers (id,product_id,organization_id,price_cents,suggested_retail_cents,commission_basis_points,preparation_days,created_at,updated_at) VALUES (?,?,?,?,?,1000,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          account.organization.id,
          basePrice,
          input.suggestedRetailCents ?? null,
          input.preparationDays,
          now,
          now,
        ),
      d1
        .prepare(
          `INSERT INTO product_price_history (id,product_id,price_cents,commission_basis_points,effective_at,changed_by) VALUES (?,?,?,1000,?,?)`,
        )
        .bind(crypto.randomUUID(), id, basePrice, now, account.user.id),
      d1
        .prepare(
          `INSERT INTO inventory_movements (id,product_id,organization_id,type,quantity,reference_type,reference_id,created_by,created_at) VALUES (?,?,?,'initial',?,'product',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          account.organization.id,
          totalStock,
          id,
          account.user.id,
          now,
        ),
      d1
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'product.created','product',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          account.user.id,
          account.organization.id,
          id,
          requestId,
          JSON.stringify({ status, qualityScore }),
          now,
        ),
      ...(input.variants.length
        ? input.variants.map((variant) =>
            d1.prepare(`INSERT INTO product_variants (id,product_id,sku,name,gtin,attributes_json,price_cents,suggested_retail_cents,stock,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'active',?,?)`).bind(crypto.randomUUID(),id,variant.sku,variant.name,variant.gtin??null,JSON.stringify(variant.attributes),variant.priceCents,variant.suggestedRetailCents??null,variant.stock,now,now),
          )
        : [d1.prepare(`INSERT INTO product_variants (id,product_id,sku,name,gtin,attributes_json,price_cents,suggested_retail_cents,stock,status,created_at,updated_at) VALUES (?,?,?,?,?,'{}',?,?,?,'active',?,?)`).bind(crypto.randomUUID(),id,input.sku,'Padrão',input.gtin??null,input.priceCents,input.suggestedRetailCents??null,input.stock,now,now)]),
    ]);
    return Response.json(
      {
        id,
        status,
        qualityScore,
        commissionCents: Math.round(input.priceCents * 0.1),
        supplierNetCents: input.priceCents - Math.round(input.priceCents * 0.1),
        requestId,
      },
      { status: 201 },
    );
  } catch (error) {
    logError(error, { requestId, route: 'POST /api/products' });
    return Response.json(
      { error: 'Não foi possível cadastrar o produto.', requestId },
      { status: 500 },
    );
  }
}
