import { getD1 } from '@/db';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function TermsPage() {
  const item = await getD1()
    .prepare(
      "SELECT value FROM system_settings WHERE key='platform_service_agreement'",
    )
    .first<{ value: string }>();
  return (
    <main className="legal-page">
      <Link href="/">← Voltar</Link>
      <h1>Contrato de prestação de serviços</h1>
      <p className="legal-copy">
        {item?.value ||
          'O contrato vigente será disponibilizado pela administração do Flubox.'}
      </p>
    </main>
  );
}
