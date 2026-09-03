import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { DocumentsForm } from './documents-form';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const user = await requireAuthenticatedUser('/onboarding/documentos');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'supplier') redirect('/dashboard');
  const result = await getD1()
    .prepare(
      `SELECT type, file_name AS fileName, status FROM documents WHERE organization_id = ? ORDER BY created_at DESC`,
    )
    .bind(account.organization.id)
    .all<{ type: string; fileName: string; status: string }>();
  return (
    <main className="onboarding-page">
      <header>
        <a href="/">
          <BrandLogo />
        </a>
        <span>{account.organization.displayName}</span>
      </header>
      <DocumentsForm existing={result.results} />
    </main>
  );
}
