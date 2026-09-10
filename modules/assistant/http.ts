export function assistantErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : 'UNKNOWN';
  const responses: Record<string, [string, number]> = {
    ACCOUNT_REQUIRED: ['Conta não encontrada.', 403],
    FORBIDDEN: ['Você não possui permissão para usar este recurso.', 403],
    ASSISTANT_DISABLED: [
      'O Assistente Flubox ainda não está disponível para esta conta.',
      503,
    ],
    ASSISTANT_QUOTA: [
      'Seu limite gratuito de hoje foi atingido. O acesso será renovado amanhã.',
      429,
    ],
    CONVERSATION_NOT_FOUND: ['Conversa não encontrada.', 404],
    EMPTY_PROMPT: ['Escreva uma pergunta antes de enviar.', 400],
  };
  const [message, status] = responses[code] ?? [
    code.includes('ativado') || code.includes('indisponível')
      ? code
      : 'Não foi possível concluir a solicitação agora.',
    500,
  ];
  return Response.json({ error: message }, { status });
}
