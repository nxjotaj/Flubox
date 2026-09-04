# ADR-001 — Persistência da aplicação

Status: substituída pela adoção de PostgreSQL/Supabase.

## Contexto

O Flubox é uma aplicação Next.js com persistência relacional, migrations versionadas e isolamento entre organizações. A arquitetura precisa sustentar catálogo, estoque, pedidos e operações financeiras com transações e integridade referencial.

## Decisão

Usar PostgreSQL hospedado no Supabase, acessado exclusivamente por módulos server-side. Os contratos de domínio não recebem tipos do provedor e as migrations PostgreSQL são versionadas em `drizzle-postgres/`.

## Consequências

- Desenvolvimento local e produção usam o mesmo modelo relacional PostgreSQL.
- Queries usam parâmetros, constraints, índices e transações nas operações críticas.
- Supabase fornece autenticação e Storage privado; regras sensíveis permanecem no servidor.
- Estoque, pedidos e ledger dependem das garantias transacionais do PostgreSQL.
- Nenhuma lógica de domínio deve depender de comportamento proprietário do provedor de hospedagem.
