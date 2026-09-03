import { describe, expect, it } from 'vitest';
import { calculateReputation } from './engine';
describe('motor de reputação', () => {
  it('atribui o maior peso ao SLA de postagem', () => {
    const perfect = {
      onTimeRate: 10000,
      fulfillmentRate: 10000,
      disputeFreeRate: 10000,
      catalogQuality: 10000,
      verificationRate: 10000,
    };
    expect(calculateReputation({ ...perfect, onTimeRate: 0 }).score).toBe(5500);
    expect(calculateReputation({ ...perfect, catalogQuality: 0 }).score).toBe(
      9000,
    );
  });
  it('limita entradas inválidas e explica componentes', () => {
    const result = calculateReputation({
      onTimeRate: 20000,
      fulfillmentRate: -1,
      disputeFreeRate: 10000,
      catalogQuality: 10000,
      verificationRate: 10000,
    });
    expect(result.score).toBe(8000);
    expect(result.components.cumprimento).toBe(0);
  });
});
