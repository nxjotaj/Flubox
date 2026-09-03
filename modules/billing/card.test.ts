import { describe, expect, it } from 'vitest';
import { cardBrand, isValidCardNumber, onlyCardDigits } from './card';

describe('cartão tokenizado de assinatura', () => {
  it('normaliza e valida pelo algoritmo de Luhn', () => {
    expect(onlyCardDigits('4242 4242 4242 4242')).toBe('4242424242424242');
    expect(isValidCardNumber('4242 4242 4242 4242')).toBe(true);
    expect(isValidCardNumber('4242 4242 4242 4241')).toBe(false);
  });
  it('identifica a bandeira sem persistir o número', () => {
    expect(cardBrand('4242424242424242')).toBe('Visa');
  });
});
