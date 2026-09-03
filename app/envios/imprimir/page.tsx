import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import { BatchPrintPreview } from './batch-print-preview';
export const dynamic = 'force-dynamic';
export default async function BatchPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const user = await requireAuthenticatedUser('/envios/imprimir');
  const account = await getAccountContext(user);
  if (!account || account.organization.type !== 'supplier')
    redirect('/dashboard');
  const { ids = '' } = await searchParams;
  return <BatchPrintPreview ids={ids} />;
}
