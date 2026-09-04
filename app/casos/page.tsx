import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import {
  AdminSectionWorkspace,
  type AdminWorkspaceRow,
} from '@/components/admin-section-workspace';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { labelFor } from '@/lib/presentation';
import { getAccountContext } from '@/modules/identity/service';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function CasesPage() {
  const user = await requireAuthenticatedUser('/casos');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  const cases = await getD1()
    .prepare(
      `SELECT c.id,c.type,c.reason,c.status,c.created_at createdAt,o.number FROM support_cases c JOIN orders o ON o.id=c.order_id WHERE o.reseller_organization_id=? OR o.supplier_organization_id=? ORDER BY c.created_at DESC`,
    )
    .bind(account.organization.id, account.organization.id)
    .all<{
      id: string;
      type: string;
      reason: string;
      status: string;
      createdAt: string;
      number: string;
    }>();
  return (
    <AppShell account={account} activePath="/casos">
      <Link className="back-link" href="/dashboard">
        <ArrowLeft /> Voltar para a visão geral
      </Link>
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <ShieldAlert /> Pós-venda rastreável
          </span>
          <h1>Casos e disputas</h1>
          <p>
            Converse, envie evidências e acompanhe a mediação vinculada ao
            pedido.
          </p>
        </div>
      </section>
      <AdminSectionWorkspace
        section="casos"
        detailBase="/mensagens"
        detailQueryParam="case"
        columns={[
          ['number', 'Pedido'],
          ['type', 'Tipo'],
          ['reason', 'Motivo'],
          ['status', 'Situação'],
          ['createdAt', 'Abertura'],
        ]}
        rows={cases.results.map(
          (item): AdminWorkspaceRow => ({
            key: item.id,
            id: item.id,
            status: item.status,
            searchText: `${item.number} ${labelFor(item.type)} ${item.reason} ${labelFor(item.status)}`,
            cells: {
              number: item.number,
              type: labelFor(item.type),
              reason: item.reason,
              status: labelFor(item.status),
              createdAt: new Date(item.createdAt).toLocaleString('pt-BR'),
            },
          }),
        )}
      />
    </AppShell>
  );
}
