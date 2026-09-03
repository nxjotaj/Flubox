import { describe, expect, it } from 'vitest';
import { addBusinessDays, getSlaStatus } from './sla';
describe('SLA logístico', () => {
  it('pula fim de semana e feriado informado', () => {
    expect(
      addBusinessDays('2026-08-28T12:00:00.000Z', 1, new Set(['2026-08-31'])),
    ).toBe('2026-09-01T12:00:00.000Z');
  });
  it('classifica prazo sem inventar entrega', () => {
    expect(
      getSlaStatus('2026-09-01T18:00:00.000Z', '2026-09-01T12:00:00.000Z'),
    ).toBe('due_today');
    expect(
      getSlaStatus('2026-09-01T10:00:00.000Z', '2026-09-01T12:00:00.000Z'),
    ).toBe('overdue');
  });
});
