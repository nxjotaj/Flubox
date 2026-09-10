# Assistente Flubox

O Assistente Flubox usa um modelo Llama no Cloudflare Workers AI para explicar dados que o próprio backend consulta e filtra. O modelo não possui conexão direta com o PostgreSQL e não executa ações operacionais.

## Configuração

Crie um token no Cloudflare com acesso ao Workers AI e configure na Vercel:

```env
ASSISTANT_ENABLED=true
CLOUDFLARE_ACCOUNT_ID=identificador_da_conta
CLOUDFLARE_AI_API_TOKEN=token_exclusivo_do_workers_ai
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
ASSISTANT_DAILY_USER_LIMIT=20
ASSISTANT_DAILY_ORGANIZATION_LIMIT=200
```

Use um token exclusivo para o Flubox. Nunca use uma chave global da conta Cloudflare. Se `ASSISTANT_ENABLED` estiver ausente ou diferente de `true`, a interface permanece visível em modo de espera e nenhuma mensagem é enviada ao provedor.

Depois das variáveis, execute a migração PostgreSQL `0012_assistant_flubox.sql`. Os limites também podem ser ajustados em **Administração > Assistente Flubox** sem alterar as credenciais.

## Privacidade e segurança

- Toda conversa é filtrada por usuário e organização ativa.
- Ferramentas server-side validam as permissões antes de consultar dados.
- O modelo recebe resumos mínimos, sem tokens, segredos ou dados de cartão.
- O assistente é somente leitura.
- Administradores visualizam métricas e códigos de falha, não o conteúdo livre das conversas.
- Nenhum provedor pago alternativo é acionado quando a franquia gratuita acaba.

## Validação antes da liberação

1. Ative primeiro em um ambiente de teste.
2. Valide separadamente administrador, fornecedor e revendedor.
3. Confirme que os relatórios batem com as telas operacionais.
4. Tente consultar dados pertencentes a outra organização e confirme a rejeição.
5. Verifique os limites, a indisponibilidade do provedor e a ausência de segredos nos logs.
