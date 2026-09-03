export type ReputationInput = {
  onTimeRate: number;
  fulfillmentRate: number;
  disputeFreeRate: number;
  catalogQuality: number;
  verificationRate: number;
};
export const REPUTATION_WEIGHTS = {
  onTimeRate: 45,
  fulfillmentRate: 20,
  disputeFreeRate: 15,
  catalogQuality: 10,
  verificationRate: 10,
} as const;
const clamp = (value: number) => Math.max(0, Math.min(10000, value));
export function calculateReputation(input: ReputationInput) {
  const components = {
    postagem: clamp(input.onTimeRate),
    cumprimento: clamp(input.fulfillmentRate),
    atendimento: clamp(input.disputeFreeRate),
    catalogo: clamp(input.catalogQuality),
    cadastro: clamp(input.verificationRate),
  };
  const score = Math.round(
    (components.postagem * 45 +
      components.cumprimento * 20 +
      components.atendimento * 15 +
      components.catalogo * 10 +
      components.cadastro * 10) /
      100,
  );
  return { score, components, weights: REPUTATION_WEIGHTS };
}
