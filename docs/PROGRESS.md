# Progresso do desenvolvimento

Atualizado em 1 de setembro de 2026.

## Estado atual

O núcleo do marketplace B2B está operacional em ambiente local com Supabase Auth, PostgreSQL e Storage privado. O fluxo autenticado completo foi executado com contas distintas de administrador, fornecedor e revendedor.

## Entregue e validado

- Identidade, perfis, organizações, RBAC, convites, múltiplos membros e seletor de organização ativa.
- Onboarding PF/PJ, dados empresariais, endereços e documentos privados.
- Aprovação administrativa exclusivamente do fornecedor; revendedor não depende de aprovação manual.
- Método de pagamento do fornecedor tokenizado sem persistir número ou CVV; mensalidade recorrente simulada localmente, tolerância e suspensão.
- Categorias e atributos dinâmicos, cadastro/edição/importação de produto, publicação automática, moderação posterior, preço e histórico.
- Estoque por movimentações, reservas concorrentes, catálogo líquido, filtros, paginação, favoritos, listas e carrinho persistente.
- Checkout de fornecedor único, snapshot comercial, PIX de desenvolvimento, confirmação idempotente, ledger e baixa de estoque.
- Obrigatoriedade de etiqueta mais NF-e/DANFE ou declaração de conteúdo após o PIX; acesso privado de revendedor e fornecedor.
- Preparação, SLA, postagem, rastreamento, entrega, impressão e notificações.
- Financeiro, repasses registrados, CSV, pós-venda, mensagens, evidências, disputas, refund/credits, reputação e relatórios.
- Administração de fornecedores, revendedores, usuários, catálogo, pedidos, financeiro, disputas, auditoria e parâmetros.
- Pool PostgreSQL reutilizável, migrations versionadas, Storage com RLS, logs, rate limit, antifraude e direitos LGPD.

## Evidência de validação

- Lint e TypeScript sem erros.
- 23 testes unitários aprovados.
- Build de produção aprovado.
- Todas as rotas autenticadas das três contas responderam com sucesso.
- Todos os comandos administrativos auditados responderam conforme esperado.
- Fluxo E2E concluído até `delivered`, com 2 documentos privados, 2 lançamentos no ledger e 3 eventos de rastreamento.

## Únicas pendências funcionais: conexões externas

- PSP para cartão recorrente, PIX real, webhook assinado, split, conciliação e estorno.
- Correios/transportadora para cotação, postagem e rastreamento automático.
- Emissão/validação fiscal externa, caso a Flubox venha a gerar documentos em vez de recebê-los do revendedor.
- Provedor transacional de e-mail/SMS/WhatsApp.
- Observabilidade, alertas, backup restaurado em ensaio, domínio e segredos de produção.
- Homologação jurídica, fiscal, LGPD, pentest e teste de carga antes de aceitar dinheiro real.
