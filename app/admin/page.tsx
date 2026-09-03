import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  Package,
  ShieldAlert,
  ShoppingCart,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AdminMaintenance } from './admin-actions';

export const dynamic = 'force-dynamic';
const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function AdminPage() {
  const user = await requireAuthenticatedUser('/admin');
  const account = await getAccountContext(user);
  if (!account) redirect('/cadastro');
  if (
    account.organization.type !== 'platform' ||
    account.role !== 'platform_admin'
  )
    redirect('/dashboard');
  const [metrics, products, _cases, organizations, orders] = await Promise.all([
    getD1()
      .prepare(
        `SELECT
      (SELECT COUNT(*) FROM organizations WHERE type='supplier' AND status='active') suppliers,
      (SELECT COUNT(*) FROM organizations WHERE type='reseller' AND status='active') resellers,
      (SELECT COUNT(*) FROM products WHERE status='approved') products,
      (SELECT COUNT(*) FROM orders) orders,
      (SELECT COUNT(*) FROM users WHERE status='active') users,
      (SELECT COUNT(*) FROM organizations WHERE type='supplier' AND status='onboarding') pendingSuppliers,
      (SELECT COALESCE(SUM(total_cents),0) FROM orders WHERE status NOT IN ('cancelled','payment_expired')) gmv,
      (SELECT COALESCE(SUM(commission_cents),0) FROM orders WHERE status NOT IN ('cancelled','payment_expired')) revenue,
      (SELECT COALESCE(SUM(amount_cents),0) FROM manual_expenses) costs,
      (SELECT COUNT(*) FROM support_cases WHERE status!='resolved') openCases`,
      )
      .first<{
        suppliers: number;
        resellers: number;
        products: number;
        orders: number;
        users: number;
        pendingSuppliers: number;
        gmv: number;
        revenue: number;
        costs: number;
        openCases: number;
      }>(),
    getD1()
      .prepare(
        `SELECT p.id,p.title,p.sku,p.quality_score qualityScore,o.display_name supplier FROM products p JOIN organizations o ON o.id=p.organization_id WHERE p.status IN ('pending_review','draft') ORDER BY p.updated_at DESC LIMIT 6`,
      )
      .all<{
        id: string;
        title: string;
        sku: string;
        qualityScore: number;
        supplier: string;
      }>(),
    getD1()
      .prepare(
        `SELECT c.id,c.type,c.reason,c.status,o.number FROM support_cases c JOIN orders o ON o.id=c.order_id WHERE c.status!='resolved' ORDER BY c.updated_at DESC LIMIT 6`,
      )
      .all<{
        id: string;
        type: string;
        reason: string;
        status: string;
        number: string;
      }>(),
    getD1()
      .prepare(
        `SELECT id,type,display_name displayName,status,created_at createdAt FROM organizations WHERE type!='platform' ORDER BY created_at DESC LIMIT 6`,
      )
      .all<{
        id: string;
        type: string;
        displayName: string;
        status: string;
        createdAt: string;
      }>(),
    getD1()
      .prepare(
        `SELECT id,number,status,total_cents totalCents,channel,created_at createdAt FROM orders ORDER BY created_at DESC LIMIT 6`,
      )
      .all<{
        id: string;
        number: string;
        status: string;
        totalCents: number;
        channel: string;
        createdAt: string;
      }>(),
  ]);
  const cards: [string, string, string, LucideIcon, string][] = [
    [
      'GMV',
      money(metrics?.gmv ?? 0),
      'Volume transacionado',
      CircleDollarSign,
      'positive',
    ],
    [
      'Receita Flubox',
      money(metrics?.revenue ?? 0),
      'Comissões registradas',
      Activity,
      'positive',
    ],
    [
      'Lucro após custos',
      money((metrics?.revenue ?? 0) - (metrics?.costs ?? 0)),
      `${money(metrics?.costs ?? 0)} em custos registrados`,
      CircleDollarSign,
      (metrics?.revenue ?? 0) >= (metrics?.costs ?? 0) ? 'positive' : 'warning',
    ],
    [
      'Fornecedores',
      String(metrics?.suppliers ?? 0),
      'Ativos na plataforma',
      Building2,
      '',
    ],
    [
      'Revendedores',
      String(metrics?.resellers ?? 0),
      'Contas ativas',
      Store,
      '',
    ],
    [
      'Pedidos',
      String(metrics?.orders ?? 0),
      'Todo o período',
      ShoppingCart,
      '',
    ],
    [
      'Produtos ativos',
      String(metrics?.products ?? 0),
      'Ofertas publicadas',
      Package,
      '',
    ],
    [
      'Disputas abertas',
      String(metrics?.openCases ?? 0),
      'Exigem acompanhamento',
      ShieldAlert,
      'warning',
    ],
    ['Usuários', String(metrics?.users ?? 0), 'Com acesso ativo', Users, ''],
    [
      'Cadastros pendentes',
      String(metrics?.pendingSuppliers ?? 0),
      'Fornecedores aguardando aprovação',
      ShieldAlert,
      (metrics?.pendingSuppliers ?? 0) > 0 ? 'warning' : 'positive',
    ],
  ];
  return (
    <AppShell account={account} activePath="/admin">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <Activity /> Operação em tempo real
          </span>
          <h1>Central de administração</h1>
          <p>
            Visão consolidada da plataforma, riscos e atividades que exigem
            ação.
          </p>
        </div>
        <a className="primary-action" href="/admin/relatorios">
          Abrir relatórios <ArrowUpRight />
        </a>
      </section>
      <section className="metric-grid admin-metrics">
        {cards.map(([label, value, description, Icon, tone]) => (
          <article className={`metric-card ${tone}`} key={label as string}>
            <div>
              <span>{label as string}</span>
              <strong>{value as string}</strong>
              <small>{description as string}</small>
            </div>
            <i>
              <Icon />
            </i>
          </article>
        ))}
      </section>
      <div className="admin-board">
        <section className="surface-card">
          <header>
            <div>
              <h2>Pedidos recentes</h2>
              <p>Últimas movimentações comerciais.</p>
            </div>
            <a href="/admin/pedidos">Ver todos</a>
          </header>
          <div className="data-list">
            {orders.results.map((order) => (
              <a href={`/pedidos/${order.id}`} key={order.id}>
                <span className="order-symbol">
                  <ShoppingCart />
                </span>
                <div>
                  <strong>{order.number}</strong>
                  <small>
                    {order.channel.replaceAll('_', ' ')} ·{' '}
                    {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                  </small>
                </div>
                <span className={`status-pill status-${String(order.status)}`}>
                  {order.status.replaceAll('_', ' ')}
                </span>
                <b>{money(order.totalCents)}</b>
              </a>
            ))}
          </div>
        </section>
        <section className="surface-card">
          <header>
            <div>
              <h2>Novas contas</h2>
              <p>Fornecedores e revendedores recentes.</p>
            </div>
            <a href="/admin/fornecedores">Gerenciar</a>
          </header>
          <div className="organization-list">
            {organizations.results.map((org) => (
              <article key={org.id}>
                <span>{org.displayName.slice(0, 1)}</span>
                <div>
                  <strong>{org.displayName}</strong>
                  <small>
                    {org.type === 'supplier' ? 'Fornecedor' : 'Revendedor'} ·{' '}
                    {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                  </small>
                </div>
                <b>{org.status}</b>
              </article>
            ))}
          </div>
        </section>
      </div>
      <div className="admin-board secondary">
        <section className="surface-card">
          <header>
            <div>
              <h2>Pendências de catálogo</h2>
              <p>Produtos incompletos que o fornecedor precisa corrigir.</p>
            </div>
          </header>
          {products.results.length ? (
            <div className="moderation-list">
              {products.results.map((product) => (
                <article key={product.id}>
                  <div>
                    <strong>{product.title}</strong>
                    <small>
                      {product.supplier} · {product.sku} · qualidade{' '}
                      {product.qualityScore}/100
                    </small>
                  </div>
                  <a
                    className="primary-action"
                    href={`/admin/catalogo/${product.id}`}
                  >
                    Ver cadastro
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <Package />
              <strong>Catálogo saudável</strong>
              <p>Nenhum produto incompleto aguardando correção.</p>
            </div>
          )}
        </section>
        <section className="surface-card">
          <header>
            <div>
              <h2>Rotinas operacionais</h2>
              <p>Processamentos manuais auditados.</p>
            </div>
          </header>
          <div className="maintenance-box">
            <AdminMaintenance />
          </div>
        </section>
      </div>
      <section className="surface-card connection-health">
        <header>
          <div>
            <h2>Status das conexões externas</h2>
            <p>
              Dependências que precisam de credenciais ou contratação para
              operar em produção.
            </p>
          </div>
          <a href="/configuracoes">Configurar</a>
        </header>
        <div className="connection-grid">
          {[
            ['Supabase e banco', true, 'Conectado'],
            [
              'Cobrança recorrente',
              Boolean(process.env.PAYMENT_PROVIDER_SECRET),
              'Credencial pendente',
            ],
            [
              'PIX e conciliação',
              Boolean(process.env.PIX_PROVIDER_SECRET),
              'Credencial pendente',
            ],
            [
              'Logística e rastreio',
              Boolean(process.env.LOGISTICS_PROVIDER_SECRET),
              'Credencial pendente',
            ],
            [
              'E-mail transacional',
              Boolean(process.env.EMAIL_PROVIDER_SECRET),
              'Credencial pendente',
            ],
          ].map(([label, connected, pending]) => (
            <article
              key={String(label)}
              className={connected ? 'connected' : 'pending'}
            >
              <i />
              <div>
                <strong>{String(label)}</strong>
                <small>{connected ? 'Operacional' : String(pending)}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
