export type OrderRiskInput = {
  amountCents: number;
  quantity: number;
  unpaidOrdersLastHour: number;
  reusedExternalReference: boolean;
};
export function assessOrderRisk(input: OrderRiskInput) {
  let score = 0;
  const signals: string[] = [];
  if (input.amountCents >= 200000) {
    score += 35;
    signals.push('high_amount');
  }
  if (input.quantity >= 20) {
    score += 20;
    signals.push('high_quantity');
  }
  if (input.unpaidOrdersLastHour >= 5) {
    score += 35;
    signals.push('order_velocity');
  }
  if (input.reusedExternalReference) {
    score += 30;
    signals.push('reused_external_reference');
  }
  return {
    score: Math.min(100, score),
    signals,
    decision: score >= 60 ? 'review' : 'allow',
  } as const;
}
