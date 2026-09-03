import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUser('/onboarding');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type === 'platform') redirect('/dashboard');
  return (
    <main className="onboarding-page">
      <header>
        <a href="/">
          <BrandLogo />
        </a>
        <span>{account.organization.displayName}</span>
      </header>
      <ProfileForm
        type={account.organization.type}
        email={account.user.email}
        name={account.user.name ?? ''}
      />
    </main>
  );
}
