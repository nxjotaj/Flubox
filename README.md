# Flubox Dropshipping

Sistema completo de operação de dropshipping, com frontend e backend independentes.

## Estrutura

- `apps/api`: API NestJS, regras de negócio, autenticação, estoque, pedidos e pagamentos.
- `apps/web`: painel React para administrador e lojistas.
- `apps/api/prisma`: modelo e migrações PostgreSQL.
- `docker-compose.yml`: PostgreSQL, Redis, MinIO/S3 e servidor local de e-mail.
- `.env.example`: variáveis necessárias para desenvolvimento e deploy.

## Estado atual

A infraestrutura, os projetos frontend/backend e o modelo relacional foram criados. Os módulos funcionais estão em implementação e ainda não devem ser tratados como uma versão pronta.

## Desenvolvimento

1. Copie `.env.example` para `.env`.
2. Execute `docker compose up -d`.
3. Execute `npm install`.
4. Execute as migrações do banco.
5. Inicie frontend e API com `npm run dev`.
