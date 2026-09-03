# Arquitetura do Flubox

## Direção

O Flubox começa como um monólito modular TypeScript. Essa escolha mantém transações críticas simples e auditáveis, sem impedir a extração futura de serviços. A aplicação web é apenas uma interface do domínio: regras críticas devem ficar em módulos server-side reutilizáveis por APIs e pelo futuro aplicativo móvel.

## Limites de domínio planejados

- Identity, Organizations e RBAC
- Suppliers e Resellers
- Catalog, Categories e Inventory
- Orders, Payments, Billing e Ledger
- Logistics, Reputation e Disputes
- Messaging, Notifications e Analytics
- Admin, Audit e Integrations

Os limites indicam responsabilidade; não autorizam criar abstrações vazias antes de cada etapa precisar delas.

## Regras transversais

- Valores monetários usam inteiros em centavos ou decimal seguro, nunca ponto flutuante.
- Toda consulta sensível aplica escopo de organização/tenant no servidor.
- Mudanças financeiras e de estoque são lançamentos imutáveis, corrigidos por compensação.
- Estados de pedidos são transições explícitas, não strings livremente editáveis.
- Webhooks e operações críticas usam idempotência e persistência antes do processamento.
- Dados históricos de pedidos usam snapshots das condições comerciais vigentes.
- Logs técnicos, auditoria e analytics são fluxos separados.

## Camadas esperadas

1. `app/`: rotas e composição da experiência web.
2. `components/`: primitivas e componentes de produto sem regras sensíveis.
3. `modules/` (quando introduzido): domínio e casos de uso por contexto.
4. `infrastructure/` (quando introduzido): persistência, serviços externos e adapters.

## Próximas decisões

As escolhas de banco, autenticação e serviços externos serão registradas em ADRs quando implementadas. Nenhum PSP, serviço de e-mail ou transportadora poderá contaminar o domínio com contratos proprietários.
