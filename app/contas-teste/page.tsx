import { notFound } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';

export const dynamic = 'force-dynamic';

export default function TestAccountsPage() {
  if (process.env.NODE_ENV !== 'development') notFound();

  return (
    <main className="simple-app-page">
      <header>
        <a href="/">
          <BrandLogo />
        </a>
      </header>
      <section>
        <span className="eyebrow">Ambiente local</span>
        <h1>Perfis de demonstração</h1>
        <p>
          Use a sessão autenticada atual para preparar e abrir cada visão do
          sistema. Esta página e os atalhos não existem em produção.
        </p>
        <div className="detail-actions">
          <a className="primary-link" href="/contas-teste/admin?role=admin">
            Abrir como administrador
          </a>
          <a
            className="primary-link"
            href="/contas-teste/supplier?role=supplier"
          >
            Abrir como fornecedor
          </a>
          <a
            className="primary-link"
            href="/contas-teste/reseller?role=reseller"
          >
            Abrir como revendedor
          </a>
        </div>
      </section>
    </main>
  );
}
