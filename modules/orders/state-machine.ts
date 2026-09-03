export const ORDER_STATES = [
  'created',
  'awaiting_documents',
  'awaiting_payment',
  'payment_expired',
  'paid_awaiting_documents',
  'ready_for_supplier',
  'preparing',
  'ready_to_ship',
  'shipped',
  'in_transit',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
  'returning',
  'refunded',
  'lost',
  'logistics_failed',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

const transitions: Record<OrderState, readonly OrderState[]> = {
  created: ['awaiting_documents', 'awaiting_payment', 'cancelled'],
  awaiting_documents: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid_awaiting_documents', 'payment_expired', 'cancelled'],
  payment_expired: ['awaiting_payment', 'cancelled'],
  paid_awaiting_documents: ['ready_for_supplier', 'cancelled', 'refunded'],
  ready_for_supplier: ['preparing', 'cancelled', 'disputed'],
  preparing: ['ready_to_ship', 'cancelled', 'disputed'],
  ready_to_ship: ['shipped', 'cancelled', 'disputed'],
  shipped: ['in_transit', 'delivered', 'lost', 'logistics_failed', 'disputed'],
  in_transit: ['delivered', 'lost', 'logistics_failed', 'disputed'],
  delivered: ['completed', 'disputed', 'returning'],
  completed: ['disputed', 'returning'],
  cancelled: [],
  disputed: ['returning', 'refunded', 'completed'],
  returning: ['refunded', 'completed'],
  refunded: [],
  lost: ['refunded', 'disputed'],
  logistics_failed: ['shipped', 'refunded', 'disputed'],
};

export function canTransitionOrder(from: OrderState, to: OrderState) {
  return transitions[from].includes(to);
}

export function assertOrderTransition(from: OrderState, to: OrderState) {
  if (!canTransitionOrder(from, to))
    throw new Error(`INVALID_ORDER_TRANSITION:${from}:${to}`);
}
