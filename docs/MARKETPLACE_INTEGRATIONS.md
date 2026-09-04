# Integrações de marketplaces

O Flubox possui um hub multicanal para contas de revendedores. Mercado Livre e Shopee usam o mesmo contrato interno, mas cada provedor permanece isolado em seu adapter.

## Ambiente de desenvolvimento

Use `INTEGRATIONS_MODE=mock`. Nesse modo, o OAuth retorna para o próprio Flubox, anúncios são simulados e o botão **Simular venda** cria um pedido real no agregado existente, com reserva de estoque e PIX de desenvolvimento por 30 minutos.

O webhook de desenvolvimento é `POST /api/integrations/webhooks/{provider}`. Assine o corpo bruto com HMAC-SHA256 usando `INTEGRATIONS_WEBHOOK_SECRET` e envie o hexadecimal em `x-flubox-signature`.

## Ativação externa

1. Cadastre aplicativos separados nos portais do Mercado Livre e da Shopee.
2. Configure os callbacks `/api/integrations/callback/mercado_livre` e `/api/integrations/callback/shopee`.
3. Configure os webhooks `/api/integrations/webhooks/mercado_livre` e `/api/integrations/webhooks/shopee`.
4. Preencha as variáveis documentadas em `.env.example` e gere uma chave aleatória exclusiva para `INTEGRATIONS_ENCRYPTION_KEY`.
5. Valide contas de teste, escopos, assinaturas e os payloads homologados antes de definir `INTEGRATIONS_MODE=live`.

Os tokens são criptografados em repouso com AES-256-GCM. Senhas das lojas nunca são solicitadas nem armazenadas.

## Limite da primeira entrega

- O modo mock cobre conexão, importação, vínculo, publicação, preço, estoque, pedidos e alertas.
- OAuth real já possui os pontos de entrada e troca de tokens.
- Chamadas de catálogo, anúncios e pedidos em modo live devem ser finalizadas contra os contratos liberados para o aplicativo durante a homologação; o sistema falha de forma explícita em vez de simular chamadas quando `INTEGRATIONS_MODE=live`.
- Perguntas, cancelamentos e devoluções geram alertas. A ação final continua no painel do marketplace.

## Operação

A fila administrativa fica em **Administração → Integrações**. Erros são registrados por conexão, anúncio, evento e execução de sincronização. A reconciliação pode ser solicitada por conta e é independente entre canais.
