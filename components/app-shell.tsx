import { BrandLogo } from '@/components/brand-logo';
import type { AccountContext } from '@/modules/identity/service';
import { signOutPath } from '@/app/chatgpt-auth';
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CircleDollarSign,
  CircleHelp,
  ClipboardList,
  FileText,
  Gauge,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
  Warehouse,
  CreditCard,
  PlugZap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { getD1 } from '@/db';
import { OrganizationSwitcher } from '@/app/components/organization-switcher';
import { AppNavigationTools } from '@/components/app-navigation-tools';
import { LiveDataRefresh } from '@/components/live-data-refresh';
import {
  roleAllows,
  type PermissionKey,
  type RoleKey,
} from '@/modules/identity/permissions';
import { labelFor } from '@/lib/presentation';

type NavigationItem = [href: string, label: string, icon: LucideIcon];

const supplierNavigation: NavigationItem[] = [
  ['/dashboard', 'Visão geral', LayoutDashboard],
  ['/produtos', 'Produtos', Package],
  ['/estoque', 'Estoque', Warehouse],
  ['/pedidos', 'Pedidos', ClipboardList],
  ['/envios', 'Envios', Truck],
  ['/financeiro', 'Financeiro', CircleDollarSign],
  ['/relatorios', 'Relatórios', BarChart3],
  ['/casos', 'Pós-venda', CircleHelp],
  ['/mensagens', 'Mensagens', MessageSquare],
  ['/equipe', 'Equipe', Users],
  ['/assinatura', 'Assinatura', CreditCard],
];

const resellerNavigation: NavigationItem[] = [
  ['/dashboard', 'Visão geral', LayoutDashboard],
  ['/fornecedores', 'Fornecedores', Building2],
  ['/catalogo', 'Todos os produtos', ShoppingBag],
  ['/carrinho', 'Carrinho', ShoppingBag],
  ['/favoritos', 'Favoritos', Heart],
  ['/listas', 'Minha vitrine', Boxes],
  ['/integracoes', 'Integrações', PlugZap],
  ['/pedidos', 'Pedidos', ClipboardList],
  ['/rastreamento', 'Rastreamento', Truck],
  ['/financeiro', 'Créditos e pagamentos', CircleDollarSign],
  ['/casos', 'Pós-venda', CircleHelp],
  ['/mensagens', 'Mensagens', MessageSquare],
];

const adminNavigation: NavigationItem[] = [
  ['/admin', 'Visão geral', Gauge],
  ['/admin/fornecedores', 'Fornecedores', Building2],
  ['/admin/revendedores', 'Revendedores', ShoppingBag],
  ['/admin/usuarios', 'Usuários e acessos', Users],
  ['/admin/catalogo', 'Catálogo e moderação', Package],
  ['/admin/pedidos', 'Pedidos', ClipboardList],
  ['/admin/financeiro', 'Financeiro e ledger', CircleDollarSign],
  ['/admin/disputas', 'Disputas', ShieldCheck],
  ['/admin/relatorios', 'Relatórios', BarChart3],
  ['/admin/auditoria', 'Auditoria', FileText],
  ['/admin/integracoes', 'Integrações', PlugZap],
];

export async function AppShell({
  account,
  activePath,
  children,
}: {
  account: AccountContext;
  activePath: string;
  children: React.ReactNode;
}) {
  const isAdmin = account.organization.type === 'platform';
  let navigation = isAdmin
    ? adminNavigation
    : account.organization.type === 'supplier'
      ? supplierNavigation
      : resellerNavigation;
  if (account.organization.type === 'supplier') {
    if (account.role.startsWith('supplier_operator_')) {
      navigation = supplierNavigation.filter(([href]) => href === '/envios');
    } else if (account.role === 'supplier_member') {
      const result = await getD1()
        .prepare(
          `SELECT permission_key permissionKey,allowed FROM member_permission_overrides WHERE member_id=?`,
        )
        .bind(account.memberId)
        .all<{ permissionKey: PermissionKey; allowed: boolean }>();
      const overrides = new Map(
        result.results.map((row) => [row.permissionKey, row.allowed]),
      );
      const pathPermission: Record<string, PermissionKey> = {
        '/dashboard': 'organization.view',
        '/produtos': 'products.view',
        '/estoque': 'products.manage',
        '/pedidos': 'orders.view',
        '/envios': 'fulfillment.view',
        '/financeiro': 'payments.view',
        '/relatorios': 'audit.view',
        '/casos': 'orders.view',
        '/mensagens': 'orders.view',
        '/equipe': 'organization.manage',
        '/assinatura': 'organization.manage',
      };
      navigation = supplierNavigation.filter(([href]) => {
        const permission = pathPermission[href];
        return (
          overrides.get(permission) ??
          roleAllows(account.role as RoleKey, permission)
        );
      });
    }
  }
  const organizations = await getD1()
    .prepare(
      `SELECT o.id,o.display_name displayName,o.type FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? AND m.status='active' AND o.status!='suspended' ORDER BY o.display_name`,
    )
    .bind(account.user.id)
    .all<{ id: string; displayName: string; type: string }>();
  const activeLabel =
    navigation.find(
      ([href]) =>
        activePath === href ||
        (href !== '/admin' && activePath.startsWith(`${href}/`)),
    )?.[1] ?? 'Central operacional';
  const accountType = isAdmin
    ? 'Administração Flubox'
    : account.organization.type === 'supplier'
      ? 'Operação do fornecedor'
      : 'Operação do revendedor';
  if (
    account.organization.type === 'reseller' &&
    account.organization.status === 'suspended'
  ) {
    return (
      <main className="suspended-account-screen">
        <BrandLogo />
        <section className="surface-card">
          <ShieldCheck />
          <h1>Conta temporariamente desativada</h1>
          <p>
            O acesso operacional está bloqueado durante o período de 30 dias
            solicitado na configuração da conta. A reativação acontece
            automaticamente ao final do prazo.
          </p>
          <a className="primary-action" href={signOutPath('/')}>
            Sair com segurança
          </a>
        </section>
      </main>
    );
  }
  return (
    <div className="app-frame">
      <LiveDataRefresh />
      <aside className="app-sidebar">
        <Link
          className="app-brand"
          href={isAdmin ? '/admin' : '/dashboard'}
          prefetch
        >
          <BrandLogo compact />
        </Link>
        <div className="workspace-chip">
          <span>{account.organization.displayName.slice(0, 1)}</span>
          <div>
            <strong>{account.organization.displayName}</strong>
            <small>
              {isAdmin
                ? 'Operação Flubox'
                : account.organization.type === 'supplier'
                  ? 'Fornecedor'
                  : 'Revendedor'}
            </small>
          </div>
        </div>
        <OrganizationSwitcher
          organizations={organizations.results}
          activeId={account.organization.id}
        />
        <span className="sidebar-section-label">Workspace</span>
        <nav aria-label="Navegação principal">
          {navigation.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              prefetch
              title={label}
              aria-label={label}
              className={
                activePath === href ||
                (href !== '/admin' && activePath.startsWith(`${href}/`))
                  ? 'active'
                  : ''
              }
            >
              <Icon /> <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <Link href="/configuracoes" prefetch>
            <Settings /> <span>Configurações</span>
          </Link>
          <a href={signOutPath('/')}>
            <LogOut /> <span>Sair</span>
          </a>
        </div>
      </aside>
      <main className="app-main">
        <header className="app-topbar">
          <div className="topbar-context">
            <span className="live-indicator" aria-label="Sistema operacional">
              <i /> Online
            </span>
            <div>
              <strong>{activeLabel}</strong>
              <small>{accountType}</small>
            </div>
          </div>
          <AppNavigationTools
            items={navigation.map(([href, label]) => ({ href, label }))}
            activePath={activePath}
            organization={account.organization.displayName}
            accountType={accountType}
            organizations={organizations.results}
            activeOrganizationId={account.organization.id}
          />
          <div className="topbar-actions">
            <a href="/notificacoes" aria-label="Notificações">
              <Bell />
            </a>
            <span className="user-avatar">
              {(account.user.name ?? account.user.email)
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <div>
              <strong>{account.user.name ?? account.user.email}</strong>
              <small>{labelFor(account.role)}</small>
            </div>
          </div>
        </header>
        <div className="app-content app-route-stage">{children}</div>
      </main>
    </div>
  );
}
