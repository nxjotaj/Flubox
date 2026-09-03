# ADR-001 — Persistência inicial na plataforma

Status: aceita para o MVP, com revisão obrigatória antes dos módulos financeiros.

## Contexto

O Flubox está sendo construído no runtime Cloudflare/Sites, que não oferece conexões TCP diretas. O produto precisa de persistência relacional, migrations e isolamento desde a fundação.

## Decisão

Usar D1/SQLite através do Drizzle nesta etapa. O acesso fica atrás de módulos server-side, e os contratos de domínio não recebem tipos do provedor. Migrations SQL são versionadas em `drizzle/`.

## Consequências

- Desenvolvimento local e hospedado usam o mesmo modelo operacional.
- Queries usam prepared statements, constraints e índices.
- D1 é aceitável para identidade, catálogo e fluxos operacionais do MVP.
- Antes da Fase 4, será feito um checkpoint obrigatório de concorrência, transações e ledger. Se as garantias exigirem PostgreSQL, a migração ocorrerá antes de dinheiro real, usando um provedor HTTP compatível com o runtime.
- Nenhuma lógica financeira pode depender de comportamento específico do SQLite.
