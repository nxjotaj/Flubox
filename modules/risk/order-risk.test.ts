import { describe, expect, it } from 'vitest';
import { assessOrderRisk } from './order-risk';
describe('antifraude de pedido', () => {
  it('permite compra comum sem sinal inventado', () =>
    expect(
      assessOrderRisk({
        amountCents: 10000,
        quantity: 2,
        unpaidOrdersLastHour: 0,
        reusedExternalReference: false,
      }),
    ).toEqual({ score: 0, signals: [], decision: 'allow' }));
  it('encaminha combinação de sinais fortes para revisão', () => {
    const result = assessOrderRisk({
      amountCents: 300000,
      quantity: 25,
      unpaidOrdersLastHour: 5,
      reusedExternalReference: true,
    });
    expect(result.decision).toBe('review');
    expect(result.score).toBe(100);
  });
});
