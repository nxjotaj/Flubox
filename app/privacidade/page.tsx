import { getD1 } from '@/db';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function PrivacyPage() {
  const item = await getD1()
    .prepare(
      "SELECT value FROM system_settings WHERE key='platform_privacy_policy'",
    )
    .first<{ value: string }>();
  return (
    <main className="legal-page">
      <Link href="/">← Voltar</Link>
      <h1>Política de privacidade</h1>
      <p className="legal-copy">
        {item?.value ||
          'A política vigente será disponibilizada pela administração do Flubox.'}
      </p>
    </main>
  );
}
