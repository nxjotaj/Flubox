export type ProductQualityInput = {
  title: string;
  description: string;
  shortDescription?: string;
  sku: string;
  brand?: string;
  gtin?: string;
  ncm?: string;
  categoryId?: string;
  priceCents: number;
  stock: number;
  preparationDays: number;
  grossWeightGrams?: number;
  packageHeightMm?: number;
  packageWidthMm?: number;
  packageLengthMm?: number;
};
export function calculateProductQuality(input: ProductQualityInput): number {
  let score = 0;
  if (input.sku.trim()) score += 10;
  if (input.title.trim().length >= 10) score += 10;
  if ((input.shortDescription?.trim().length ?? 0) >= 20) score += 10;
  if (input.description.trim().length >= 100) score += 15;
  if (input.categoryId) score += 15;
  if (input.brand?.trim()) score += 8;
  if (input.gtin?.trim()) score += 5;
  if (input.ncm?.trim()) score += 8;
  if (Number.isInteger(input.priceCents) && input.priceCents > 0) score += 6;
  if (Number.isInteger(input.stock) && input.stock >= 0) score += 3;
  if (Number.isInteger(input.preparationDays) && input.preparationDays > 0)
    score += 3;
  if (
    Number.isInteger(input.grossWeightGrams) &&
    (input.grossWeightGrams ?? 0) > 0
  )
    score += 5;
  if (
    [input.packageHeightMm, input.packageWidthMm, input.packageLengthMm].every(
      (value) => Number.isInteger(value) && (value ?? 0) > 0,
    )
  )
    score += 5;
  return Math.min(100, score);
}
export function canSubmitForReview(score: number): boolean {
  return score >= 70;
}
