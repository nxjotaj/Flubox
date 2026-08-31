import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useFluboxTheme } from "../theme/FluboxTheme";
type NavItem = {
  to: string;
  label: string;
  icon: typeof Gauge;
  count?: number;
};
type Group = { label: string; items: NavItem[] };
export function AppShell() {
  const { user, logout } = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const { mode, toggleMode } = useFluboxTheme();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(""),
    [notificationCount, setNotificationCount] = useState(0);
  useEffect(() => {
    api<Array<{ readAt: string | null }>>("/notifications")
      .then((x) => setNotificationCount(x.filter((n) => !n.readAt).length))
      .catch(() => undefined);
  }, [location.pathname]);
  const groups = useMemo<Group[]>(
    () =>
      user?.role === "SELLER"
        ? [
            {
              label: "Início",
              items: [{ to: "/dashboard", label: "Visão geral", icon: Gauge }],
            },
            {
              label: "Operação",
              items: [
                { to: "/catalog/products", label: "Catálogo", icon: Boxes },
                {
                  to: "/catalog/exports",
                  label: "Exportações",
                  icon: FileText,
                },
                { to: "/orders/new", label: "Novo pedido", icon: ShoppingBag },
                {
                  to: "/operations/orders",
                  label: "Meus pedidos",
                  icon: ClipboardList,
                },
                {
                  to: "/operations/payments",
                  label: "Pagamentos",
                  icon: CreditCard,
                },
                {
                  to: "/operations/documents",
                  label: "Documentos",
                  icon: FileText,
                },
              ],
            },
            {
              label: "Atendimento",
              items: [
                { to: "/messages", label: "Mensagens", icon: MessageSquare },
                {
                  to: "/operations/cases",
                  label: "Ocorrências",
                  icon: ShieldCheck,
                },
              ],
            },
            {
              label: "Conta",
              items: [
                {
                  to: "/settings/profile",
                  label: "Perfil e segurança",
                  icon: Settings,
                },
              ],
            },
          ]
        : [
            {
              label: "Início",
              items: [{ to: "/dashboard", label: "Visão geral", icon: Gauge }],
            },
            {
              label: "Operação",
              items: [
                {
                  to: "/operations/orders",
                  label: "Pedidos",
                  icon: ClipboardList,
                },
                {
                  to: "/operations/payments",
                  label: "Pagamentos",
                  icon: CreditCard,
                },
                {
                  to: "/operations/documents",
                  label: "Documentos",
                  icon: FileText,
                },
                { to: "/operations/shipping", label: "Expedição", icon: Truck },
                {
                  to: "/operations/cases",
                  label: "Ocorrências",
                  icon: ShieldCheck,
                },
              ],
            },
            {
              label: "Catálogo",
              items: [
                { to: "/catalog/products", label: "Produtos", icon: Boxes },
                { to: "/catalog/inventory", label: "Estoque", icon: Warehouse },
                {
                  to: "/catalog/exports",
                  label: "Importações e exportações",
                  icon: FileText,
                },
              ],
            },
            {
              label: "Relacionamento",
              items: [
                { to: "/sellers", label: "Lojistas", icon: Users },
                { to: "/messages", label: "Comunicação", icon: MessageSquare },
              ],
            },
            {
              label: "Dados",
              items: [
                { to: "/data/metrics", label: "Métricas", icon: LineChart },
                { to: "/data/reports", label: "Relatórios", icon: FileText },
                { to: "/data/audit", label: "Auditoria", icon: ShieldCheck },
              ],
            },
            {
              label: "Configurações",
              items: [
                {
                  to: "/settings/company",
                  label: "Empresa e coleta",
                  icon: Building2,
                },
                { to: "/settings/pix", label: "Pix", icon: CreditCard },
                {
                  to: "/settings/team",
                  label: "Equipe e permissões",
                  icon: Users,
                },
                {
                  to: "/settings/security",
                  label: "Segurança e privacidade",
                  icon: Settings,
                },
              ],
            },
          ],
    [user?.role],
  );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setMobile(false);
    }
  };
  const crumbs = location.pathname
    .split("/")
    .filter(Boolean)
    .map((x) => x.replaceAll("-", " "));
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">F</span>
          {!collapsed && (
            <div>
              <strong>Flubox</strong>
              <small>Central operacional</small>
            </div>
          )}
          <button
            className="icon-button collapse"
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>
        <nav>
          {groups.map((g) => (
            <section className="nav-group" key={g.label}>
              {!collapsed && <small>{g.label}</small>}
              {g.items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  title={i.label}
                  onClick={() => setMobile(false)}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <i.icon />
                  <span>{i.label}</span>
                  {i.count ? <b>{i.count}</b> : null}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-account">
          <div className="avatar">{user?.name?.slice(0, 2).toUpperCase()}</div>
          {!collapsed && (
            <div>
              <strong>{user?.name}</strong>
              <small>
                {user?.role === "SELLER"
                  ? "Lojista"
                  : user?.role === "ADMIN"
                    ? "Administrador"
                    : "Colaborador"}
              </small>
            </div>
          )}
          <button
            className="icon-button"
            title="Sair"
            onClick={() => void logout()}
          >
            <LogOut />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            aria-label="Abrir menu lateral"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <form className="global-search" onSubmit={submit}>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pedido, SKU, produto, lojista ou rastreio"
            />
            <kbd>Enter</kbd>
          </form>
          <div className="top-actions">
            <button
              className="icon-button"
              title={mode === "dark" ? "Usar tema claro" : "Usar tema escuro"}
              aria-label={mode === "dark" ? "Usar tema claro" : "Usar tema escuro"}
              onClick={toggleMode}
            >
              {mode === "dark" ? <Sun /> : <Moon />}
            </button>
            <button className="icon-button" title="Ajuda">
              <CircleHelp />
            </button>
            <button
              className="icon-button notification"
              title="Notificações"
              onClick={() => navigate("/notifications")}
            >
              <Bell />
              {notificationCount > 0 && <b>{notificationCount}</b>}
            </button>
            <button
              className="profile-button"
              onClick={() =>
                navigate(
                  user?.role === "SELLER"
                    ? "/settings/profile"
                    : "/settings/company",
                )
              }
            >
              <span>{user?.name}</span>
              <ChevronDown />
            </button>
          </div>
        </header>
        <div className="breadcrumb">
          <span>Flubox</span>
          {crumbs.map((c) => (
            <span key={c}>/ {c}</span>
          ))}
        </div>
        <main>
          <Outlet />
        </main>
      </div>
      {mobile && (
        <button
          aria-label="Fechar menu"
          className="scrim"
          onClick={() => setMobile(false)}
        />
      )}
    </div>
  );
}
