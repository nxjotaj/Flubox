# Flubox

Sistema web operacional de marketplace B2B que conecta fornecedores com estoque próprio a revendedores.

## O que está funcionando

- Autenticação Supabase, RBAC, multiusuário e troca de organização.
- Aprovação administrativa somente do fornecedor.
- Assinatura mensal do fornecedor com cartão tokenizado no ambiente local.
- Catálogo com publicação automática, atributos por categoria, importação, estoque, filtros, favoritos, listas e carrinho.
- Pedido de fornecedor único, reserva de estoque e PIX de desenvolvimento.
- Envio da etiqueta e da nota/declaração pelo revendedor após o PIX.
- Preparação, postagem, rastreamento, impressão, financeiro, pós-venda, mensagens, disputas, auditoria e relatórios.

As conexões externas reais (PSP/cartão/PIX, transportadora, e-mail e observabilidade) permanecem pendentes. O sistema falha de forma segura em produção enquanto o PSP não estiver configurado.

## Desenvolvimento local

Requisitos: Node.js 22.13 ou superior.

```bash
npm install
npm run db:migrate
npm run dev
```

Abra `http://localhost:3000/entrar`. Os acessos locais estão documentados em [docs/TEST_ACCOUNTS.md](docs/TEST_ACCOUNTS.md).

## Validação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

As auditorias autenticadas usam `SMOKE_PASSWORD` e o servidor local em execução:

```bash
npm run audit:routes
npm run audit:commands
npm run audit:order
```

Consulte [docs/PROGRESS.md](docs/PROGRESS.md) e [docs/LAUNCH_READINESS.md](docs/LAUNCH_READINESS.md).
