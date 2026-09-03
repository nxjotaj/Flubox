import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { BrandLogo } from '@/components/brand-logo';
import { AcceptInvitation } from './accept-invitation';
export const dynamic = 'force-dynamic';
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  await requireAuthenticatedUser(
    `/convites/aceitar${params.token ? `?token=${encodeURIComponent(params.token)}` : ''}`,
  );
  const valid = /^[a-f0-9]{64}$/.test(params.token ?? '');
  return (
    <main className="simple-app-page">
      <header>
        <a href="/">
          <BrandLogo />
        </a>
      </header>
      <section>
        <span className="eyebrow">Acesso à organização</span>
        <h1>Convite de equipe</h1>
        {valid ? (
          <>
            <p>
              Confirme para entrar na organização com o papel definido pelo
              responsável.
            </p>
            <AcceptInvitation token={params.token!} />
          </>
        ) : (
          <div className="catalog-empty">
            O link de convite é inválido ou está incompleto.
          </div>
        )}
      </section>
    </main>
  );
}
