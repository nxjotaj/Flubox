import { getAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { ShieldCheck } from 'lucide-react';
import { LoginForm } from './login-form';
import { getAccountContext } from '@/modules/identity/service';

export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const user = await getAuthenticatedUser();
  const account = user ? await getAccountContext(user) : null;
  const panelPath = !account
    ? '/cadastro'
    : account.organization.type === 'platform'
      ? '/admin'
      : '/dashboard';
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <a href="/">
          <BrandLogo />
        </a>
        <div className="auth-copy">
          <span className="eyebrow">Acesso seguro</span>
          <h1>
            {user
              ? 'Sua sessão está pronta.'
              : 'Entre para movimentar seu negócio.'}
          </h1>
          <p>
            {user
              ? `Identificamos você como ${user.displayName}. Continue para configurar ou acessar sua operação.`
              : 'Acesse seus produtos, pedidos e resultados com identidade protegida pela plataforma.'}
          </p>
          {user ? (
            <a className="button button-primary auth-primary" href={panelPath}>
              Continuar para o painel
            </a>
          ) : (
            <LoginForm />
          )}
          <p className="auth-security">
            <ShieldCheck size={16} /> A Flubox não recebe nem armazena sua senha
            em texto aberto.
          </p>
        </div>
      </section>
      <aside className="auth-aside" aria-label="Benefícios do Flubox">
        <div>
          <span>Operação conectada</span>
          <strong>
            Do estoque
            <br />à entrega.
          </strong>
          <p>
            Pedidos, documentos, pagamentos e acompanhamento em um único fluxo.
          </p>
        </div>
      </aside>
    </main>
  );
}
