import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { logError, requestIdFrom } from '@/lib/request-context';
import {
  calculateProductQuality,
  canSubmitForReview,
} from '@/modules/catalog/quality';
import { requireAccountPermission } from '@/modules/identity/service';
import { z } from 'zod';

const schema = z.object({
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
  priceCents: z.int().positive(),
  suggestedRetailCents: z.int().positive().optional(),
  preparationDays: z.int().min(1).max(30),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(100),
        sku: z.string().trim().min(1).max(64),
        gtin: z.string().trim().max(14).optional(),
        attributes: z.record(z.string(), z.string().max(100)).default({}),
        priceCents: z.int().positive(),
        suggestedRetailCents: z.int().positive().optional(),
        stock: z.int().nonnegative(),
      }),
    )
    .min(1)
    .max(100),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
        { error: 'Acesso exclusivo do fornecedor.', requestId },
        { status: 403 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Revise o produto.',
          requestId,
        },
        { status: 422 },
      );
    const { id } = await params;
    const current = await getD1()
      .prepare(
        `SELECT p.id,p.sku,p.category_id categoryId,o.price_cents priceCents,COALESCE((SELECT SUM(stock) FROM product_variants WHERE product_id=p.id AND status='active'),0) totalStock FROM products p JOIN supplier_offers o ON o.product_id=p.id WHERE p.id=? AND p.organization_id=?`,
      )
      .bind(id, account.organization.id)
      .first<{
        id: string;
        sku: string;
        categoryId: string | null;
        priceCents: number;
        totalStock: number;
      }>();
    if (!current)
      return Response.json(
        { error: 'Produto não encontrado.', requestId },
        { status: 404 },
      );
    const qualityScore = calculateProductQuality({
      ...parsed.data,
      sku: current.sku,
      categoryId: current.categoryId ?? undefined,
      stock: parsed.data.variants.reduce(
        (sum, variant) => sum + variant.stock,
        0,
      ),
    });
    const status = canSubmitForReview(qualityScore) ? 'approved' : 'draft';
    const now = new Date().toISOString();
    const statements = [
      getD1()
        .prepare(
          `UPDATE products SET title=?,description=?,short_description=?,brand=?,gtin=?,ncm=?,net_weight_grams=?,gross_weight_grams=?,product_height_mm=?,product_width_mm=?,product_length_mm=?,package_height_mm=?,package_width_mm=?,package_length_mm=?,composition=?,voltage=?,status=?,quality_score=?,updated_at=? WHERE id=? AND organization_id=?`,
        )
        .bind(
          parsed.data.title,
          parsed.data.description,
          parsed.data.shortDescription,
          parsed.data.brand ?? null,
          parsed.data.gtin ?? null,
          parsed.data.ncm ?? null,
          parsed.data.netWeightGrams ?? null,
          parsed.data.grossWeightGrams,
          parsed.data.productHeightMm ?? null,
          parsed.data.productWidthMm ?? null,
          parsed.data.productLengthMm ?? null,
          parsed.data.packageHeightMm,
          parsed.data.packageWidthMm,
          parsed.data.packageLengthMm,
          parsed.data.composition ?? null,
          parsed.data.voltage ?? null,
          status,
          qualityScore,
          now,
          id,
          account.organization.id,
        ),
      getD1()
        .prepare(
          `UPDATE supplier_offers SET price_cents=?,suggested_retail_cents=?,preparation_days=?,updated_at=? WHERE product_id=? AND organization_id=?`,
        )
        .bind(
          parsed.data.priceCents,
          parsed.data.suggestedRetailCents ?? null,
          parsed.data.preparationDays,
          now,
          id,
          account.organization.id,
        ),
      getD1()
        .prepare(
          `INSERT INTO audit_logs (id,actor_user_id,organization_id,action,entity_type,entity_id,request_id,metadata,created_at) VALUES (?,?,?,'product.updated','product',?,?,?,?)`,
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
    ];
    const variantIds = parsed.data.variants
      .map((variant) => variant.id)
      .filter(Boolean) as string[];
    statements.push(
      getD1()
        .prepare(
          `UPDATE product_variants SET status='inactive',updated_at=? WHERE product_id=?${variantIds.length ? ` AND id NOT IN (${variantIds.map(() => '?').join(',')})` : ''}`,
        )
        .bind(now, id, ...variantIds),
      ...parsed.data.variants.map((variant) =>
        variant.id
          ? getD1()
              .prepare(
                `UPDATE product_variants SET sku=?,name=?,gtin=?,attributes_json=?,price_cents=?,suggested_retail_cents=?,stock=?,status='active',updated_at=? WHERE id=? AND product_id=?`,
              )
              .bind(
                variant.sku,
                variant.name,
                variant.gtin ?? null,
                JSON.stringify(variant.attributes),
                variant.priceCents,
                variant.suggestedRetailCents ?? null,
                variant.stock,
                now,
                variant.id,
                id,
              )
          : getD1()
              .prepare(
                `INSERT INTO product_variants (id,product_id,sku,name,gtin,attributes_json,price_cents,suggested_retail_cents,stock,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'active',?,?)`,
              )
              .bind(
                crypto.randomUUID(),
                id,
                variant.sku,
                variant.name,
                variant.gtin ?? null,
                JSON.stringify(variant.attributes),
                variant.priceCents,
                variant.suggestedRetailCents ?? null,
                variant.stock,
                now,
                now,
              ),
      ),
    );
    const nextStock = parsed.data.variants.reduce(
      (sum, variant) => sum + variant.stock,
      0,
    );
    const stockDelta = nextStock - Number(current.totalStock);
    if (stockDelta !== 0)
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO inventory_movements (id,product_id,organization_id,type,quantity,reference_type,reference_id,created_by,created_at) VALUES (?,?,?,'adjustment',?,'product_edit',?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            id,
            account.organization.id,
            stockDelta,
            id,
            account.user.id,
            now,
          ),
      );
    if (current.priceCents !== parsed.data.priceCents)
      statements.push(
        getD1()
          .prepare(
            `INSERT INTO product_price_history (id,product_id,price_cents,commission_basis_points,effective_at,changed_by) SELECT ?,product_id,?,commission_basis_points,?,? FROM supplier_offers WHERE product_id=?`,
          )
          .bind(
            crypto.randomUUID(),
            parsed.data.priceCents,
            now,
            account.user.id,
            id,
          ),
      );
    await getD1().batch(statements);
    return Response.json({ id, status, qualityScore, requestId });
  } catch (error) {
    logError(error, { requestId, route: 'PATCH product' });
    return Response.json(
      { error: 'Não foi possível atualizar o produto.', requestId },
      { status: 500 },
    );
  }
}
