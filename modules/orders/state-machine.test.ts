import { describe, expect, it } from 'vitest';
import { assertOrderTransition, canTransitionOrder } from './state-machine';

describe('máquina de estados do pedido', () => {
  it('permite confirmação do pagamento e avanço operacional', () => {
    expect(
      canTransitionOrder('awaiting_payment', 'paid_awaiting_documents'),
    ).toBe(true);
    expect(
      canTransitionOrder('paid_awaiting_documents', 'ready_for_supplier'),
    ).toBe(true);
    expect(canTransitionOrder('paid_awaiting_documents', 'preparing')).toBe(
      false,
    );
  });
  it('impede saltos e alteração de pedido terminal', () => {
    expect(() => assertOrderTransition('created', 'shipped')).toThrow(
      'INVALID_ORDER_TRANSITION',
    );
    expect(canTransitionOrder('cancelled', 'paid_awaiting_documents')).toBe(
      false,
    );
  });
});
