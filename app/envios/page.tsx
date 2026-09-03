import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { Clock3, Truck } from 'lucide-react';
import { redirect } from 'next/navigation';
import {
  FulfillmentWorkbench,
  type FulfillmentRow,
} from './fulfillment-workbench';

export const dynamic = 'force-dynamic';
export default async function ShipmentsPage() {
  const user = await requireAuthenticatedUser('/envios');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'supplier') redirect('/dashboard');
  const operator = account.role.startsWith('supplier_operator_');
  const [rows, operators] = await Promise.all([
    getD1()
      .prepare(
        `SELECT o.id,o.number,o.status,r.display_name reseller,s.preparation_deadline deadline,COALESCE(SUM(oi.quantity),0) total_units,STRING_AGG(DISTINCT (oi.product_snapshot::jsonb->>'title'),', ') item_summary,COALESCE((SELECT SUM(d.quantity_covered) FROM order_documents d WHERE d.order_id=o.id AND d.type='shipping_label'),0) label_units,(SELECT COUNT(*) FROM order_documents d WHERE d.order_id=o.id AND d.type IN ('nfe_danfe','content_declaration')) fiscal_count,fa.member_id assigned_member_id,COALESCE(u.name,u.email) assigned_name FROM orders o JOIN organizations r ON r.id=o.reseller_organization_id JOIN order_items oi ON oi.order_id=o.id LEFT JOIN shipments s ON s.order_id=o.id LEFT JOIN fulfillment_assignments fa ON fa.order_id=o.id LEFT JOIN organization_members am ON am.id=fa.member_id LEFT JOIN users u ON u.id=am.user_id WHERE o.supplier_organization_id=? AND o.status IN ('ready_for_supplier','preparing','ready_to_ship','shipped') AND (?=FALSE OR fa.member_id=?) GROUP BY o.id,r.display_name,s.preparation_deadline,fa.member_id,u.name,u.email ORDER BY CASE WHEN s.preparation_deadline IS NULL THEN 1 ELSE 0 END,s.preparation_deadline,o.created_at`,
      )
      .bind(account.organization.id, operator, account.memberId)
      .all<FulfillmentRow>(),
    getD1()
      .prepare(
        `SELECT m.id,COALESCE(u.name,u.email) name FROM organization_members m JOIN users u ON u.id=m.user_id JOIN roles r ON r.id=m.role_id WHERE m.organization_id=? AND m.status='active' AND r.key IN ('supplier_operator_1','supplier_operator_2') ORDER BY r.key`,
      )
      .bind(account.organization.id)
      .all<{ id: string; name: string }>(),
  ]);
  return (
    <AppShell account={account} activePath="/envios">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <Truck /> Operação de expedição
          </span>
          <h1>
            {operator
              ? 'Minha fila de separação'
              : 'Central de separação e envio'}
          </h1>
          <p>
            Priorize o prazo, imprima documentos em lote e dê baixa por código
            de barras.
          </p>
        </div>
        <span className="sla-rule">
          <Clock3 /> Postagem em até 1 dia útil após o PIX
        </span>
      </section>
      <FulfillmentWorkbench
        rows={rows.results}
        operators={operators.results}
        isOwner={account.role === 'supplier_owner'}
      />
    </AppShell>
  );
}
