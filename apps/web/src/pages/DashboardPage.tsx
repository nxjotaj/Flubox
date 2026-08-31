import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  CreditCard,
  FileWarning,
  PackageCheck,
  Truck,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ActionButton, Loading, PageHeader, StatCard, StatusBadge } from "../components/ui";
type Group = {
  status: string;
  _count: number;
  _sum: { total?: number; amount?: number };
};
type Dash = {
  products: number;
  pendingSellers: number;
  orders: Group[];
  payments: Group[];
  lowStock: Array<{
    id: string;
    sku: string;
    name: string;
    stockOnHand: number;
    reservedStock: number;
  }>;
  recent: Array<{
    id: string;
    number: string;
    status: string;
    total: number;
    seller?: { name: string; companyName?: string };
    createdAt: string;
    files: unknown[];
  }>;
};
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v || 0,
  );
export function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null),
    [error, setError] = useState("");
  const nav = useNavigate(),
    { user } = useAuth();
  useEffect(() => {
    api<Dash>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (!data && !error) return <Loading />;
  if (error) return <div className="error-panel">{error}</div>;
  const orders = data!.orders.reduce((a, x) => a + x._count, 0),
    review = data!.payments.find((x) => x.status === "REVIEW")?._count || 0,
    docs = data!.recent.filter(
      (x) => x.status === "DOCUMENTS_PENDING" && x.files.length < 2,
    ).length,
    shipping = data!.recent.filter((x) =>
      ["PAID", "SEPARATING", "READY_TO_SHIP"].includes(x.status),
    ).length;
  return (
    <>
      <PageHeader
        title={`Olá, ${user?.name?.split(" ")[0]}`}
        description="Prioridades, filas e saúde da operação com dados reais do Flubox."
        actions={
          <ActionButton
            tone="primary"
            aria-label={user?.role === "SELLER" ? "Criar pedido" : "Abrir expedição"}
            onClick={() =>
              nav(
                user?.role === "SELLER"
                  ? "/orders/new"
                  : "/operations/shipping",
              )
            }
          >
            {user?.role === "SELLER" ? "Criar pedido" : "Abrir expedição"}{" "}
            <ArrowRight />
          </ActionButton>
        }
      />
      <section className="stats-grid">
        <StatCard
          label="Pedidos"
          value={orders}
          detail="Todos os estados"
          onClick={() => nav("/operations/orders")}
        />
        <StatCard
          label="Pagamentos em revisão"
          value={review}
          detail="Exigem conferência"
          onClick={() => nav("/operations/payments?status=REVIEW")}
        />
        <StatCard
          label="Documentos pendentes"
          value={docs}
          detail="Etiqueta ou fiscal"
          onClick={() => nav("/operations/documents?status=pending")}
        />
        <StatCard
          label="Prontos para operar"
          value={shipping}
          detail="Separação e envio"
          onClick={() => nav("/operations/shipping")}
        />
      </section>
      {user?.role !== "SELLER" && (
        <section className="priority-grid">
          <article className="panel">
            <div className="panel-title">
              <div>
                <h2>Prioridades</h2>
                <p>Resolva os bloqueios que impactam a operação.</p>
              </div>
            </div>
            <div className="task-list">
              {data!.pendingSellers > 0 && (
                <button onClick={() => nav("/sellers?status=PENDING_APPROVAL")}>
                  <Users />
                  <span>
                    <strong>
                      {data!.pendingSellers} lojista(s) aguardando aprovação
                    </strong>
                    <small>Revise os dados cadastrais e decida o acesso.</small>
                  </span>
                  <ArrowRight />
                </button>
              )}
              {review > 0 && (
                <button
                  onClick={() => nav("/operations/payments?status=REVIEW")}
                >
                  <CreditCard />
                  <span>
                    <strong>{review} pagamento(s) em revisão</strong>
                    <small>Confira webhook, valor e comprovante.</small>
                  </span>
                  <ArrowRight />
                </button>
              )}
              {docs > 0 && (
                <button onClick={() => nav("/operations/documents")}>
                  <FileWarning />
                  <span>
                    <strong>{docs} pedido(s) com documentos incompletos</strong>
                    <small>Etiqueta e documento fiscal são obrigatórios.</small>
                  </span>
                  <ArrowRight />
                </button>
              )}
              {data!.lowStock.length > 0 && (
                <button onClick={() => nav("/catalog/inventory?filter=low")}>
                  <AlertTriangle />
                  <span>
                    <strong>
                      {data!.lowStock.length} produto(s) em estoque crítico
                    </strong>
                    <small>
                      O saldo disponível está em cinco unidades ou menos.
                    </small>
                  </span>
                  <ArrowRight />
                </button>
              )}
              {data!.pendingSellers + review + docs + data!.lowStock.length ===
                0 && (
                <div className="all-clear">
                  <PackageCheck />
                  Nenhuma prioridade crítica agora.
                </div>
              )}
            </div>
          </article>
          <article className="panel">
            <div className="panel-title">
              <div>
                <h2>Filas de trabalho</h2>
                <p>Atalhos para as principais etapas.</p>
              </div>
            </div>
            <div className="queue-grid">
              <button
                onClick={() =>
                  nav("/operations/orders?status=AWAITING_PAYMENT")
                }
              >
                <Clock />
                <strong>Aguardando Pix</strong>
                <span>
                  {data!.orders.find((x) => x.status === "AWAITING_PAYMENT")
                    ?._count || 0}
                </span>
              </button>
              <button
                onClick={() => nav("/operations/shipping?queue=separation")}
              >
                <Boxes />
                <strong>Em separação</strong>
                <span>
                  {data!.orders.find((x) => x.status === "SEPARATING")
                    ?._count || 0}
                </span>
              </button>
              <button onClick={() => nav("/operations/shipping?queue=ready")}>
                <Truck />
                <strong>Prontos</strong>
                <span>
                  {data!.orders.find((x) => x.status === "READY_TO_SHIP")
                    ?._count || 0}
                </span>
              </button>
              <button onClick={() => nav("/operations/orders?status=SHIPPED")}>
                <PackageCheck />
                <strong>Enviados</strong>
                <span>
                  {data!.orders.find((x) => x.status === "SHIPPED")?._count ||
                    0}
                </span>
              </button>
            </div>
          </article>
        </section>
      )}
      <section className="two-columns">
        <article className="panel">
          <div className="panel-title">
            <div>
              <h2>Pedidos recentes</h2>
              <p>Últimas movimentações da operação.</p>
            </div>
            <button
              className="link-button"
              onClick={() => nav("/operations/orders")}
            >
              Ver todos
            </button>
          </div>
          <div className="data-list">
            {data!.recent.map((o) => (
              <button
                key={o.id}
                onClick={() => nav(`/operations/orders/${o.id}`)}
              >
                <span>
                  <strong>{o.number}</strong>
                  <small>
                    {o.seller?.companyName || o.seller?.name || "Minha conta"} ·{" "}
                    {new Date(o.createdAt).toLocaleString("pt-BR")}
                  </small>
                </span>
                <span>
                  <StatusBadge>{o.status}</StatusBadge>
                  <strong>{money(Number(o.total))}</strong>
                </span>
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-title">
            <div>
              <h2>Estoque crítico</h2>
              <p>Saldo físico e reservado.</p>
            </div>
            <button
              className="link-button"
              onClick={() => nav("/catalog/inventory")}
            >
              Gerenciar
            </button>
          </div>
          <div className="data-list">
            {data!.lowStock.map((p) => (
              <button
                key={p.id}
                onClick={() => nav(`/catalog/products/${p.id}`)}
              >
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.sku}</small>
                </span>
                <span>
                  <strong>{p.stockOnHand - p.reservedStock} disponível</strong>
                  <small>{p.reservedStock} reservado</small>
                </span>
              </button>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
