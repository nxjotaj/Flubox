# Contas locais de teste

Abra `http://localhost:3000/entrar` e use:

| Perfil        | E-mail                     | Senha local    |
| ------------- | -------------------------- | -------------- |
| Administrador | `admin@flubox.com.br`      | `Flubox@2026!` |
| Fornecedor    | `fornecedor@flubox.com.br` | `Flubox@2026!` |
| Revendedor    | `revendedor@flubox.com.br` | `Flubox@2026!` |

Essas credenciais são exclusivamente de desenvolvimento e precisam ser substituídas antes de qualquer publicação.

Depois de entrar, o administrador abre `/admin`; fornecedor e revendedor abrem `/dashboard`. A página `/contas-teste` permite preparar perfis de demonstração adicionais usando uma sessão local já autenticada.

O PIX e o cartão funcionam por provedores de desenvolvimento. Nenhum dado completo de cartão ou CVV é persistido. Transportadora, pagamento real, e-mail e demais conexões externas continuam pendentes.
