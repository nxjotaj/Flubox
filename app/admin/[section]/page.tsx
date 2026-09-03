import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect, notFound } from 'next/navigation';
import {
  AdminSectionWorkspace,
  type AdminWorkspaceRow,
} from '@/components/admin-section-workspace';
import { CreateSupplier } from '../supplier-admin-tools';
import { CreateUserInvite } from '../user-admin-tools';
import { AdminMaintenance } from '../admin-actions';

export const dynamic = 'force-dynamic';
type Row = Record<string, unknown>;
const definitions: Record<
  string,
  {
    title: string;
    description: string;
    query: string;
    columns: [string, string][];
    detailBase?: string;
  }
> = {
  fornecedores: {
    title: 'Fornecedores',
    description: 'Cadastro, validação, assinatura e saúde comercial.',
    query: `SELECT o.id,o.display_name name,o.status,sp.cnpj,sp.reputation_basis_points reputation,s.status subscription,o.created_at createdAt FROM organizations o LEFT JOIN supplier_profiles sp ON sp.organization_id=o.id LEFT JOIN subscriptions s ON s.organization_id=o.id WHERE o.type='supplier' ORDER BY o.created_at DESC`,
    detailBase: '/admin/fornecedores',
    columns: [
      ['name', 'Fornecedor'],
      ['cnpj', 'CNPJ'],
      ['status', 'Status'],
      ['subscription', 'Assinatura'],
      ['reputation', 'Reputação'],
      ['createdAt', 'Cadastro'],
    ],
  },
  revendedores: {
    title: 'Revendedores',
    description: 'Contas, comportamento operacional e pedidos.',
    query: `SELECT o.id,o.display_name name,o.status,r.cpf,r.phone,(SELECT COUNT(*) FROM orders x WHERE x.reseller_organization_id=o.id) orders,(SELECT COALESCE(SUM(total_cents),0) FROM orders x WHERE x.reseller_organization_id=o.id AND x.status NOT IN ('cancelled','payment_expired')) volume,(SELECT ROUND(100.0*COUNT(*) FILTER (WHERE x.status NOT IN ('awaiting_payment','payment_expired','cancelled'))/NULLIF(COUNT(*),0),1) FROM orders x WHERE x.reseller_organization_id=o.id) paymentSuccess,(SELECT ROUND(100.0*COUNT(*) FILTER (WHERE x.status IN ('shipped','in_transit','delivered','completed'))/NULLIF(COUNT(*) FILTER (WHERE x.status NOT IN ('awaiting_payment','payment_expired','cancelled')),0),1) FROM orders x WHERE x.reseller_organization_id=o.id) shippingSuccess,o.created_at createdAt FROM organizations o LEFT JOIN reseller_profiles r ON r.organization_id=o.id WHERE o.type='reseller' ORDER BY o.created_at DESC`,
    detailBase: '/admin/revendedores',
    columns: [
      ['name', 'Revendedor'],
      ['cpf', 'CPF'],
      ['phone', 'Telefone'],
      ['status', 'Status'],
      ['orders', 'Pedidos'],
      ['volume', 'Movimentação'],
      ['paymentSuccess', 'Pagamentos OK %'],
      ['shippingSuccess', 'Envios OK %'],
      ['createdAt', 'Cadastro'],
    ],
  },
  usuarios: {
    title: 'Usuários e acessos',
    description: 'Membros, papéis e isolamento entre organizações.',
    query: `SELECT m.id,COALESCE(u.name,u.email) name,u.email,o.display_name organization,r.name role,m.status,u.last_login_at lastLoginAt,m.created_at createdAt FROM organization_members m JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=m.organization_id JOIN roles r ON r.id=m.role_id ORDER BY m.created_at DESC`,
    detailBase: '/admin/usuarios',
    columns: [
      ['name', 'Usuário'],
      ['email', 'E-mail'],
      ['organization', 'Organização'],
      ['role', 'Papel'],
      ['status', 'Status'],
      ['lastLoginAt', 'Último acesso'],
      ['createdAt', 'Acesso desde'],
    ],
  },
  catalogo: {
    title: 'Catálogo e moderação',
    description: 'Qualidade, disponibilidade e situação das ofertas.',
    query: `SELECT p.id,p.title,p.sku,o.display_name supplier,p.status,p.quality_score quality,so.price_cents price,p.updated_at updatedAt FROM products p JOIN organizations o ON o.id=p.organization_id LEFT JOIN supplier_offers so ON so.product_id=p.id ORDER BY p.updated_at DESC`,
    detailBase: '/admin/catalogo',
    columns: [
      ['title', 'Produto'],
      ['sku', 'SKU'],
      ['supplier', 'Fornecedor'],
      ['status', 'Status'],
      ['quality', 'Qualidade'],
      ['price', 'Preço'],
      ['updatedAt', 'Atualização'],
    ],
  },
  pedidos: {
    title: 'Pedidos',
    description: 'Acompanhamento operacional de ponta a ponta.',
    query: `SELECT o.id,o.number,o.status,o.channel,o.total_cents total,s.display_name supplier,r.display_name reseller,o.created_at createdAt FROM orders o JOIN organizations s ON s.id=o.supplier_organization_id JOIN organizations r ON r.id=o.reseller_organization_id ORDER BY o.created_at DESC LIMIT 100`,
    detailBase: '/pedidos',
    columns: [
      ['number', 'Pedido'],
      ['status', 'Status'],
      ['channel', 'Canal'],
      ['supplier', 'Fornecedor'],
      ['reseller', 'Revendedor'],
      ['total', 'Valor'],
      ['createdAt', 'Criado em'],
    ],
  },
  financeiro: {
    title: 'Financeiro e ledger',
    description: 'Movimentações, comissões, créditos e reconciliação.',
    query: `SELECT l.created_at createdAt,o.display_name organization,l.account,l.direction,l.amount_cents amount,l.currency,l.status,l.reference_type reference FROM ledger_entries l JOIN organizations o ON o.id=l.organization_id ORDER BY l.created_at DESC LIMIT 200`,
    columns: [
      ['createdAt', 'Data'],
      ['organization', 'Organização'],
      ['account', 'Conta'],
      ['direction', 'Direção'],
      ['amount', 'Valor'],
      ['status', 'Status'],
      ['reference', 'Referência'],
    ],
  },
  disputas: {
    title: 'Disputas e pós-venda',
    description: 'Mediação, evidências e resoluções documentadas.',
    query: `SELECT c.id,o.number,c.type,c.reason,c.status,org.display_name openedBy,c.created_at createdAt FROM support_cases c JOIN orders o ON o.id=c.order_id JOIN organizations org ON org.id=c.opened_by_organization_id ORDER BY c.created_at DESC`,
    detailBase: '/admin/disputas',
    columns: [
      ['number', 'Pedido'],
      ['type', 'Tipo'],
      ['reason', 'Motivo'],
      ['openedBy', 'Aberto por'],
      ['status', 'Status'],
      ['createdAt', 'Abertura'],
    ],
  },
  auditoria: {
    title: 'Auditoria',
    description: 'Registro imutável das ações sensíveis da plataforma.',
    query: `SELECT a.created_at createdAt,COALESCE(u.name,u.email) actor,a.action,a.entity_type entity,a.entity_id entityId,a.reason,a.request_id requestId FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 200`,
    columns: [
      ['createdAt', 'Data'],
      ['actor', 'Responsável'],
      ['action', 'Ação'],
      ['entity', 'Entidade'],
      ['entityId', 'ID'],
      ['reason', 'Justificativa'],
      ['requestId', 'Request ID'],
    ],
  },
  relatorios: {
    title: 'Relatórios da plataforma',
    description: 'Indicadores consolidados de operação, catálogo e receita.',
    query: `SELECT date_trunc('month',o.created_at::timestamptz) createdAt,COUNT(*) orders,COALESCE(SUM(o.total_cents),0) total,COALESCE(SUM(o.commission_cents),0) amount FROM orders o GROUP BY date_trunc('month',o.created_at::timestamptz) ORDER BY createdAt DESC LIMIT 24`,
    columns: [
      ['createdAt', 'Período'],
      ['orders', 'Pedidos'],
      ['total', 'GMV'],
      ['amount', 'Receita Flubox'],
    ],
  },
};
function display(key: string, value: unknown) {
  if (value == null) return '—';
  if (['price', 'total', 'amount', 'volume'].includes(key))
    return (Number(value) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  if (key === 'reputation') return `${(Number(value) / 100).toFixed(1)}%`;
  if (
    ['createdAt', 'updatedAt', 'lastLoginAt'].includes(key) &&
    typeof value === 'string'
  ) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value.replaceAll('_', ' ');
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'bigint') return value.toString();
  return '—';
}
export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const definition = definitions[section];
  if (!definition) notFound();
  const user = await requireAuthenticatedUser(`/admin/${section}`);
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (account.organization.type !== 'platform') redirect('/dashboard');
  const rows = await getD1().prepare(definition.query).all<Row>();
  const invitationOrganizations =
    section === 'usuarios'
      ? await getD1()
          .prepare(
            `SELECT id,display_name name,type FROM organizations WHERE status!='archived' ORDER BY type,display_name`,
          )
          .all<{ id: string; name: string; type: string }>()
      : { results: [] };
  const insights =
    section === 'pedidos'
      ? await getD1()
          .prepare(
            `SELECT COUNT(*) FILTER (WHERE created_at::timestamptz>=CURRENT_DATE) today,COUNT(*) FILTER (WHERE created_at::timestamptz>=date_trunc('week',NOW())) AS "week",COUNT(*) FILTER (WHERE created_at::timestamptz>=date_trunc('month',NOW())) AS "month",COUNT(*) FILTER (WHERE status IN ('payment_expired','logistics_failed','lost')) errors,(SELECT COUNT(*) FROM order_anomalies WHERE resolved_at IS NULL) anomalies FROM orders`,
          )
          .first<{
            today: number;
            week: number;
            month: number;
            errors: number;
            anomalies: number;
          }>()
      : section === 'fornecedores'
        ? await getD1()
            .prepare(
              `SELECT COUNT(*) FILTER (WHERE o.status='active') active,COUNT(*) FILTER (WHERE o.status!='active') inactive,COUNT(*) FILTER (WHERE s.status='past_due') delinquent,COUNT(*) FILTER (WHERE s.status IN ('active','trialing')) regular FROM organizations o LEFT JOIN subscriptions s ON s.organization_id=o.id WHERE o.type='supplier'`,
            )
            .first<{
              active: number;
              inactive: number;
              delinquent: number;
              regular: number;
            }>()
        : section === 'auditoria'
          ? await getD1()
              .prepare(
                `SELECT (SELECT COUNT(*) FROM order_anomalies WHERE resolved_at IS NULL) anomalies,(SELECT COUNT(*) FROM shipments WHERE shipped_at IS NULL AND preparation_deadline::timestamptz<NOW()) overdue,(SELECT COUNT(*) FROM payment_intents WHERE status='failed') failedPayments,(SELECT COUNT(*) FROM products WHERE status='draft') incompleteProducts,(SELECT COUNT(*) FROM organizations WHERE type='supplier' AND status='onboarding') pendingSuppliers`,
              )
              .first<Record<string, number>>()
          : null;
  const supplierRanking =
    section === 'pedidos'
      ? await getD1()
          .prepare(
            `SELECT s.id,s.display_name name,COUNT(*) orders,COUNT(*) FILTER (WHERE o.status IN ('shipped','in_transit','delivered','completed')) successful,COUNT(*) FILTER (WHERE o.status IN ('logistics_failed','lost','cancelled')) incidents,ROUND(100.0*COUNT(*) FILTER (WHERE sh.shipped_at IS NOT NULL AND sh.shipped_at::timestamptz<=sh.preparation_deadline::timestamptz)/NULLIF(COUNT(sh.id),0),1) onTime FROM organizations s JOIN orders o ON o.supplier_organization_id=s.id LEFT JOIN shipments sh ON sh.order_id=o.id GROUP BY s.id,s.display_name ORDER BY onTime DESC NULLS LAST,successful DESC LIMIT 10`,
          )
          .all<{
            id: string;
            name: string;
            orders: number;
            successful: number;
            incidents: number;
            onTime: number | null;
          }>()
      : null;
  return (
    <AppShell account={account} activePath={`/admin/${section}`}>
      <section className="page-heading">
        <div>
          <span className="page-kicker">Administração</span>
          <h1>{definition.title}</h1>
          <p>{definition.description}</p>
        </div>
        <div className="heading-actions">
          {section === 'fornecedores' && <CreateSupplier />}
          {section === 'usuarios' && (
            <CreateUserInvite organizations={invitationOrganizations.results} />
          )}{' '}
          {section === 'pedidos' && (
            <a
              className="secondary-action"
              href="/api/admin/reports/orders.csv"
            >
              Exportar histórico completo
            </a>
          )}
        </div>
      </section>
      {insights && (
        <section className="workspace-summary section-insights">
          {Object.entries(insights)
            .filter(
              ([key]) =>
                !key.includes('_') &&
                key !== 'failedpayments' &&
                key !== 'incompleteproducts' &&
                key !== 'pendingsuppliers',
            )
            .map(([key, value]) => (
              <article
                key={key}
                className={
                  Number(value) > 0 &&
                  [
                    'errors',
                    'anomalies',
                    'overdue',
                    'failedPayments',
                    'delinquent',
                    'pendingSuppliers',
                  ].includes(key)
                    ? 'needs-attention'
                    : 'healthy'
                }
              >
                <span>
                  {(
                    {
                      today: 'Pedidos hoje',
                      week: 'Pedidos na semana',
                      month: 'Pedidos no mês',
                      errors: 'Pedidos com erro',
                      anomalies: 'Anomalias abertas',
                      active: 'Fornecedores ativos',
                      inactive: 'Inativos ou pendentes',
                      delinquent: 'Inadimplentes',
                      regular: 'Mensalidade regular',
                      overdue: 'Envios atrasados',
                      failedPayments: 'Pagamentos falhos',
                      incompleteProducts: 'Produtos incompletos',
                      pendingSuppliers: 'Cadastros pendentes',
                    } as Record<string, string>
                  )[key] ?? key}
                </span>
                <strong>{Number(value)}</strong>
                <small>atualizado em tempo real</small>
              </article>
            ))}
        </section>
      )}
      {supplierRanking && (
        <section className="surface-card ranking-card">
          <header>
            <div>
              <h2>Ranking operacional de fornecedores</h2>
              <p>Pontualidade, volume concluído e incidentes registrados.</p>
            </div>
          </header>
          <div className="ranking-list">
            {supplierRanking.results.map((supplier, index) => (
              <a href={`/admin/fornecedores/${supplier.id}`} key={supplier.id}>
                <b>{index + 1}</b>
                <div>
                  <strong>{supplier.name}</strong>
                  <small>
                    {supplier.orders} pedidos · {supplier.successful} avançados
                    · {supplier.incidents} incidentes
                  </small>
                </div>
                <span>{supplier.onTime ?? 0}% no prazo</span>
              </a>
            ))}
          </div>
        </section>
      )}
      {section === 'auditoria' && (
        <section className="surface-card maintenance-box audit-diagnostics">
          <div>
            <h2>Diagnóstico e manutenção</h2>
            <p>
              Execute rotinas idempotentes, acompanhe pendências e consulte o
              registro auditável produzido por cada comando.
            </p>
          </div>
          <AdminMaintenance />
        </section>
      )}
      <AdminSectionWorkspace
        section={section}
        columns={definition.columns}
        detailBase={definition.detailBase}
        rows={rows.results.map((row, index): AdminWorkspaceRow => {
          const cells = Object.fromEntries(
            definition.columns.map(([key]) => [key, display(key, row[key])]),
          );
          const rawStatus = row.status;
          return {
            key: typeof row.id === 'string' ? row.id : `${section}-${index}`,
            id: typeof row.id === 'string' ? row.id : undefined,
            status:
              typeof rawStatus === 'string'
                ? rawStatus.toLowerCase()
                : undefined,
            searchText: Object.values(cells).join(' '),
            cells,
          };
        })}
      />
    </AppShell>
  );
}
