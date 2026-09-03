import { requireAuthenticatedUser } from '@/app/chatgpt-auth';
import { AppShell } from '@/components/app-shell';
import { getD1 } from '@/db';
import { getAccountContext } from '@/modules/identity/service';
import { redirect } from 'next/navigation';
import {
  ArrowUpRight,
  Box,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  type LucideIcon,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
const money = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default async function DashboardPage() {
  const authUser = await requireAuthenticatedUser('/dashboard');
  const account = await getAccountContext(authUser);
  if (!account) redirect('/cadastro');
  if (account.organization.type === 'platform') redirect('/admin');
  if (account.role.startsWith('supplier_operator_')) redirect('/envios');
  const supplier = account.organization.type === 'supplier';
  const organizationId = account.organization.id;
  const [metrics, recentOrders, notifications, products] = await Promise.all([
    getD1()
      .prepare(
        supplier
          ? `SELECT COUNT(*) orders,COALESCE(SUM(total_cents),0) volume,SUM(CASE WHEN status IN ('paid_awaiting_documents','ready_for_supplier','preparing','ready_to_ship') THEN 1 ELSE 0 END) pending,SUM(CASE WHEN status IN ('shipped','in_transit') THEN 1 ELSE 0 END) transit,(SELECT COUNT(*) FROM products WHERE organization_id=?) products,(SELECT COUNT(*) FROM products p WHERE p.organization_id=? AND (SELECT COALESCE(SUM(quantity),0) FROM inventory_movements m WHERE m.product_id=p.id)<=5) lowStock,(SELECT COALESCE(SUM(net_cents),0) FROM payouts WHERE organization_id=? AND status='paid') paidOut,(SELECT COUNT(*) FROM shipments s JOIN orders x ON x.id=s.order_id WHERE x.supplier_organization_id=? AND s.shipped_at IS NULL AND s.preparation_deadline::timestamptz<NOW()) overdue FROM orders WHERE supplier_organization_id=?`
          : `SELECT COUNT(*) orders,COALESCE(SUM(total_cents),0) volume,SUM(CASE WHEN status IN ('shipped','in_transit') THEN 1 ELSE 0 END) transit,SUM(CASE WHEN status='awaiting_payment' THEN 1 ELSE 0 END) paymentPending,SUM(CASE WHEN status='paid_awaiting_documents' THEN 1 ELSE 0 END) docsPending,(SELECT COUNT(*) FROM product_favorites WHERE organization_id=?) favorites,(SELECT COUNT(*) FROM supplier_followers WHERE reseller_organization_id=?) following,(SELECT COALESCE(SUM(remaining_cents),0) FROM relationship_credits WHERE reseller_organization_id=? AND status='available') credits FROM orders WHERE reseller_organization_id=?`,
      )
      .bind(...(supplier ? [organizationId,organizationId,organizationId,organizationId,organizationId] : [organizationId,organizationId,organizationId,organizationId]))
      .first<{
        orders: number;
        volume: number;
        pending: number;
        transit: number;
        favorites: number;
        products:number;lowStock:number;paidOut:number;overdue:number;paymentPending:number;docsPending:number;following:number;credits:number;
      }>(),
    getD1()
      .prepare(
        `SELECT id,number,status,total_cents totalCents,channel,created_at createdAt FROM orders WHERE ${supplier ? 'supplier_organization_id' : 'reseller_organization_id'}=? ORDER BY created_at DESC LIMIT 5`,
      )
      .bind(organizationId)
      .all<{
        id: string;
        number: string;
        status: string;
        totalCents: number;
        channel: string;
        createdAt: string;
      }>(),
    getD1()
      .prepare(
        'SELECT id,title,body,read_at readAt,created_at createdAt FROM notifications WHERE organization_id=? ORDER BY created_at DESC LIMIT 4',
      )
      .bind(organizationId)
      .all<{
        id: string;
        title: string;
        body: string;
        readAt: string | null;
        createdAt: string;
      }>(),
    supplier
      ? getD1()
          .prepare(
            `SELECT p.id,p.title,p.sku,COALESCE(SUM(m.quantity),0) stock FROM products p LEFT JOIN inventory_movements m ON m.product_id=p.id WHERE p.organization_id=? GROUP BY p.id ORDER BY stock ASC LIMIT 5`,
          )
          .bind(organizationId)
          .all<{ id: string; title: string; sku: string; stock: number }>()
      : Promise.resolve({
          results: [] as {
            id: string;
            title: string;
            sku: string;
            stock: number;
          }[],
        }),
  ]);
  const cards: [string, string, string, LucideIcon, string][] = supplier
    ? [
        [
          'Vendas acumuladas',
          money(metrics?.volume ?? 0),
          'Pedidos pagos e processados',
          CircleDollarSign,
          'positive',
      ],
      ['Produtos publicados',String(metrics?.products??0),'Catálogo da organização',PackageCheck,''],
      ['Estoque crítico',String(metrics?.lowStock??0),'Itens com 5 unidades ou menos',Box,(metrics?.lowStock??0)>0?'warning':'positive'],
      ['Repasses pagos',money(metrics?.paidOut??0),'Líquido recebido',CircleDollarSign,'positive'],
      ['Envios atrasados',String(metrics?.overdue??0),'Acima do prazo de 1 dia útil',Clock3,(metrics?.overdue??0)>0?'warning':'positive'],
        [
          'Pedidos recebidos',
          String(metrics?.orders ?? 0),
          'Todo o período',
          ShoppingCart,
          '',
      ],
      ['Aguardando PIX',String(metrics?.paymentPending??0),'Pedidos ainda não conciliados',Clock3,(metrics?.paymentPending??0)>0?'warning':''],
      ['Documentos pendentes',String(metrics?.docsPending??0),'Etiquetas ou fiscal a enviar',Box,(metrics?.docsPending??0)>0?'warning':'positive'],
      ['Fornecedores seguidos',String(metrics?.following??0),'Alertas comerciais ativos',PackageCheck,'positive'],
      ['Créditos disponíveis',money(metrics?.credits??0),'Créditos por relacionamento',CircleDollarSign,'positive'],
        [
          'A preparar',
          String(metrics?.pending ?? 0),
          'Exigem ação da equipe',
          Clock3,
          'warning',
        ],
        [
          'Em transporte',
          String(metrics?.transit ?? 0),
          'Postados e acompanhados',
          Truck,
          '',
        ],
      ]
    : [
        [
          'Compras acumuladas',
          money(metrics?.volume ?? 0),
          'Todo o período',
          CircleDollarSign,
          '',
        ],
        [
          'Pedidos criados',
          String(metrics?.orders ?? 0),
          'Em todos os canais',
          ShoppingCart,
          '',
        ],
        [
          'Em transporte',
          String(metrics?.transit ?? 0),
          'Acompanhe as entregas',
          Truck,
          '',
        ],
        [
          'Produtos favoritos',
          String(metrics?.favorites ?? 0),
          'Itens salvos',
          PackageCheck,
          'positive',
        ],
      ];
  return (
    <AppShell account={account} activePath="/dashboard">
      <section className="page-heading">
        <div>
          <span className="page-kicker">
            <Sparkles /> Visão geral
          </span>
          <h1>
            Olá,{' '}
            {
              (account.user.name ?? account.organization.displayName).split(
                ' ',
              )[0]
            }
            .
          </h1>
          <p>
            {supplier
              ? 'Acompanhe vendas, prazos, estoque e saúde da sua distribuição.'
              : 'Acompanhe seus pedidos e encontre novas oportunidades para vender.'}
          </p>
        </div>
        <a
          className="primary-action"
          href={supplier ? '/produtos' : '/catalogo'}
        >
          {supplier ? 'Cadastrar produto' : 'Explorar catálogo'}{' '}
          <ArrowUpRight />
        </a>
      </section>
      <section className="metric-grid">
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
      <div className="dashboard-grid">
        <section className="surface-card wide">
          <header>
            <div>
              <h2>Pedidos recentes</h2>
              <p>Movimentações mais recentes da operação.</p>
            </div>
            <a href="/pedidos">Ver todos</a>
          </header>
          {recentOrders.results.length ? (
            <div className="data-list">
              {recentOrders.results.map((order) => (
                <a href={`/pedidos/${order.id}`} key={order.id}>
                  <span className="order-symbol">
                    <Box />
                  </span>
                  <div>
                    <strong>{order.number}</strong>
                    <small>
                      {order.channel.replaceAll('_', ' ')} ·{' '}
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </small>
                  </div>
                  <span
                    className={`status-pill status-${String(order.status)}`}
                  >
                    {order.status.replaceAll('_', ' ')}
                  </span>
                  <b>{money(order.totalCents)}</b>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <ShoppingCart />
              <strong>Nenhum pedido ainda</strong>
              <p>Os pedidos aparecerão aqui assim que a operação começar.</p>
            </div>
          )}
        </section>
        <section className="surface-card">
          <header>
            <div>
              <h2>{supplier ? 'Atenção no estoque' : 'Atualizações'}</h2>
              <p>
                {supplier
                  ? 'Itens com menor disponibilidade.'
                  : 'O que aconteceu na sua conta.'}
              </p>
            </div>
          </header>
          {supplier ? (
            <div className="stock-list">
              {products.results.map((product) => (
                <a href="/produtos" key={product.id}>
                  <div>
                    <strong>{product.title}</strong>
                    <small>{product.sku}</small>
                  </div>
                  <span className={product.stock <= 5 ? 'critical' : ''}>
                    {product.stock} un.
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div className="notification-list">
              {notifications.results.length ? (
                notifications.results.map((item) => (
                  <article key={item.id}>
                    <i />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state compact">
                  <Sparkles />
                  <strong>Tudo em dia</strong>
                  <p>Sem novas notificações.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      {supplier && (
        <section className="account-health">
          <div>
            <span>Saúde da conta</span>
            <strong>97,2%</strong>
            <p>
              Seu catálogo e atendimento estão excelentes. Priorize os itens com
              estoque baixo.
            </p>
          </div>
          <div className="health-track">
            <i style={{ width: '97.2%' }} />
          </div>
          <a href="/relatorios">
            Ver detalhes <ArrowUpRight />
          </a>
        </section>
      )}
    </AppShell>
  );
}
