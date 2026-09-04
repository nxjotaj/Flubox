const labels: Record<string, string> = {
  active: 'Ativa',
  pending: 'Pendente',
  past_due: 'Pagamento atrasado',
  grace_period: 'Período de tolerância',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
  delivered: 'Entregue',
  shipped: 'Enviado',
  in_transit: 'Em trânsito',
  preparing: 'Em preparação',
  ready_to_ship: 'Pronto para envio',
  awaiting_payment: 'Aguardando pagamento',
  payment_expired: 'Pagamento expirado',
  completed: 'Concluído',
  refunded: 'Reembolsado',
  supplier_owner: 'Proprietário do fornecedor',
  reseller_owner: 'Proprietário revendedor',
  platform_admin: 'Administrador da plataforma',
  supplier_member: 'Colaborador do fornecedor',
  supplier_operator_1: 'Operador de expedição 1',
  supplier_operator_2: 'Operador de expedição 2',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  draft: 'Rascunho',
  paused: 'Pausado',
  error: 'Erro',
  revoked: 'Revogado',
  expired: 'Expirado',
  payment_succeeded: 'Mensalidade paga',
  payment_failed: 'Pagamento recusado',
  payment_method_updated: 'Cartão atualizado',
  cancellation_scheduled: 'Cancelamento agendado',
  cancellation_reversed: 'Cancelamento desfeito',
  subscription_cancelled: 'Assinatura cancelada',
  dispute: 'Disputa',
  open: 'Aberta',
  under_review: 'Em análise',
  resolved: 'Resolvida',
  closed: 'Encerrada',
};

export function labelFor(
  value: string | null | undefined,
  fallback = 'Não informado',
) {
  if (!value) return fallback;
  return (
    labels[value] ??
    value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
  );
}
