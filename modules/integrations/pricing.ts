import type { PricingRule } from './types';

export function calculateListingPrice(
  costCents: number,
  rule: PricingRule,
): number {
  if (!Number.isSafeInteger(costCents) || costCents < 0)
    throw new Error('INVALID_COST');
  if (rule.mode === 'fixed') {
    if (
      !Number.isSafeInteger(rule.fixedPriceCents) ||
      rule.fixedPriceCents < costCents
    )
      throw new Error('INVALID_FIXED_PRICE');
    return rule.fixedPriceCents;
  }
  if (
    !Number.isSafeInteger(rule.marginBasisPoints) ||
    rule.marginBasisPoints < 0 ||
    rule.marginBasisPoints > 100000
  )
    throw new Error('INVALID_MARGIN');
  return Math.ceil((costCents * (10000 + rule.marginBasisPoints)) / 10000);
}

export function calculatePublishableStock(
  physicalStock: number,
  reservedStock: number,
  safetyStock: number,
): number {
  for (const value of [physicalStock, reservedStock, safetyStock])
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error('INVALID_STOCK');
  return Math.max(0, physicalStock - reservedStock - safetyStock);
}
