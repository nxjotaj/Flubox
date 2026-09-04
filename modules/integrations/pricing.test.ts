import { describe, expect, it } from 'vitest';
import { calculateListingPrice, calculatePublishableStock } from './pricing';

describe('marketplace pricing', () => {
  it('calcula margem em basis points sem ponto flutuante monetário', () => {
    expect(
      calculateListingPrice(10_000, {
        mode: 'margin',
        marginBasisPoints: 2500,
      }),
    ).toBe(12_500);
    expect(
      calculateListingPrice(999, { mode: 'margin', marginBasisPoints: 1000 }),
    ).toBe(1099);
  });
  it('rejeita preço fixo abaixo do custo', () => {
    expect(() =>
      calculateListingPrice(10_000, { mode: 'fixed', fixedPriceCents: 9_999 }),
    ).toThrow('INVALID_FIXED_PRICE');
  });
  it('subtrai reservas e estoque de segurança sem publicar saldo negativo', () => {
    expect(calculatePublishableStock(20, 4, 2)).toBe(14);
    expect(calculatePublishableStock(2, 2, 1)).toBe(0);
  });
});
