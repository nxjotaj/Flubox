import { describe, expect, it } from 'vitest';
import { calculateProductQuality, canSubmitForReview } from './quality';
describe('qualidade do produto', () => {
  it('não publica silenciosamente produto incompleto', () => {
    const score = calculateProductQuality({
      title: 'Curto',
      description: 'Pouco conteúdo',
      sku: 'SKU-1',
      priceCents: 1000,
      stock: 1,
      preparationDays: 1,
    });
    expect(score).toBeLessThan(70);
    expect(canSubmitForReview(score)).toBe(false);
  });
  it('considera cadastro comercial completo elegível para revisão', () => {
    const score = calculateProductQuality({
      title: 'Fone Bluetooth com Cancelamento de Ruído',
      description: 'Descrição completa '.repeat(10),
      shortDescription: 'Fone premium sem fio com cancelamento ativo de ruído.',
      sku: 'FONE-1',
      brand: 'Flu',
      gtin: '7891234567890',
      ncm: '85183000',
      categoryId: 'audio',
      priceCents: 12990,
      stock: 20,
      preparationDays: 1,
      grossWeightGrams: 420,
      packageHeightMm: 220,
      packageWidthMm: 180,
      packageLengthMm: 90,
    });
    expect(score).toBe(100);
    expect(canSubmitForReview(score)).toBe(true);
  });
});
