import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { OrganizationForm } from './organization-form';
import { BrandLogo } from '@/components/brand-logo';

export const dynamic = 'force-dynamic';

export default async function RegistrationPage() {
  const authUser = await requireAuthenticatedUser('/cadastro');
  const account = await getAccountContext(authUser);
  if (account) redirect('/dashboard');

  return (
    <main className="onboarding-page">
      <header>
        <a href="/">
          <BrandLogo />
        </a>
        <span>Conta: {authUser.email}</span>
      </header>
      <OrganizationForm defaultName={authUser.fullName ?? ''} />
    </main>
  );
}
