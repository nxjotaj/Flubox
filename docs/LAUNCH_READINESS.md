# Readiness de lançamento

## Aprovado localmente

- Supabase Auth, PostgreSQL e Storage privado com políticas RLS.
- Separação por organização, RBAC server-side e multiacesso.
- Aprovação apenas do fornecedor e assinatura recorrente preparada para PSP.
- Catálogo automático, estoque, carrinho, pedidos, documentos, logística, financeiro e pós-venda.
- Reservas, ledger, audit log, idempotência, rate limit e migrations.
- Auditorias autenticadas de rotas, comandos e fluxo integral de pedido.

## Dependências externas pendentes

- Homologar PSP de cartão/PIX, webhook, split, refund e conciliação.
- Homologar transportadora/Correios e rastreamento automático.
- Configurar e-mail transacional e observabilidade/alertas.
- Configurar domínio, segredos, backup/restauração e políticas do ambiente publicado.
- Executar pentest, carga e validação jurídica/fiscal/LGPD.

## Bloqueio de go-live

O ambiente não deve aceitar dinheiro real até o PSP e os webhooks estarem homologados. O provedor de desenvolvimento existe somente para testes e o código de produção falha de forma segura sem uma conexão externa válida.
