import { useEffect, useMemo, useState } from "react";
import { Download, Search, ShoppingCart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, download } from "../lib/api";
import { EmptyState, Loading, PageHeader, StatusBadge } from "../components/ui";
import type { Product } from "./ProductsPage";
export function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Relatórios e métricas"
        description="Exportações reconciliadas com pedidos, pagamentos e estoque do Flubox."
      />
      <div className="stats-grid">
        <article className="panel">
          <h2>Funil operacional</h2>
          <p>
            Pedido → reserva → Pix → pagamento → documentos → separação → envio.
          </p>
        </article>
        <article className="panel">
          <h2>Relatório de pedidos</h2>
          <p>Itens, lojistas, valores, estados, documentos e expedição.</p>
          <button
            className="primary"
            onClick={() =>
              void download("/exports/orders.xlsx", "pedidos-flubox.xlsx")
            }
          >
            <Download /> Exportar Excel
          </button>
        </article>
        <article className="panel">
          <h2>Catálogo e estoque</h2>
          <p>Saldos físicos, reservas e dados completos do catálogo.</p>
          <button
            className="secondary"
            onClick={() =>
              void download("/exports/catalog.xlsx", "catalogo-flubox.xlsx")
            }
          >
            <Download /> Exportar catálogo
          </button>
        </article>
      </div>
    </>
  );
}
export function NotificationsPage() {
  const [items, setItems] = useState<Array<{
    id: string;
    title: string;
    body: string;
    status: string;
    readAt?: string;
    createdAt: string;
  }> | null>(null);
  const load = () => api<typeof items>("/notifications").then(setItems);
  useEffect(() => {
    void load();
  }, []);
  if (!items) return <Loading />;
  return (
    <>
      <PageHeader
        title="Notificações"
        description="Avisos de cadastro, pagamento, documentos, estoque e expedição."
      />
      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma notificação"
          description="Eventos relevantes aparecerão aqui."
        />
      ) : (
        <div className="notification-list">
          {items.map((n) => (
            <button
              key={n.id}
              className={n.readAt ? "read" : ""}
              onClick={() =>
                void api(`/notifications/${n.id}/read`, {
                  method: "PATCH",
                }).then(load)
              }
            >
              <span>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <small>{new Date(n.createdAt).toLocaleString("pt-BR")}</small>
              </span>
              {!n.readAt && <i />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
export function SearchPage() {
  const q = new URLSearchParams(useLocation().search).get("q") || "",
    nav = useNavigate(),
    [products, setProducts] = useState<Product[] | null>(null),
    [orders, setOrders] = useState<Array<{
      id: string;
      number: string;
      recipientName: string;
      status: string;
      trackingCode?: string;
      items: Array<{ sku: string; name: string }>;
    }> | null>(null);
  useEffect(() => {
    Promise.all([
      api<Product[]>(`/products?search=${encodeURIComponent(q)}`),
      api<typeof orders>("/orders"),
    ]).then(([p, o]) => {
      setProducts(p);
      setOrders(
        (o || []).filter((x) =>
          [
            x.number,
            x.recipientName,
            x.trackingCode,
            ...x.items.flatMap((i) => [i.sku, i.name]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase()),
        ),
      );
    });
  }, [q]);
  if (!products || !orders) return <Loading />;
  return (
    <>
      <PageHeader
        title={`Resultados para “${q}”`}
        description={`${products.length + orders.length} resultado(s) encontrado(s).`}
      />
      <section className="two-columns">
        <article className="panel">
          <h2>Produtos</h2>
          <div className="data-list">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => nav(`/catalog/products/${p.id}`)}
              >
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.sku}</small>
                </span>
                <StatusBadge>{p.status}</StatusBadge>
              </button>
            ))}
          </div>
        </article>
        <article className="panel">
          <h2>Pedidos</h2>
          <div className="data-list">
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => nav(`/operations/orders/${o.id}`)}
              >
                <span>
                  <strong>{o.number}</strong>
                  <small>{o.recipientName}</small>
                </span>
                <StatusBadge>{o.status}</StatusBadge>
              </button>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
export function DomainPage({ kind }: { kind: "messages" | "cases" | "audit" }) {
  const content = {
    messages: [
      "Comunicação",
      "Conversas internas entre a equipe Flubox e lojistas, vinculadas a pedidos e produtos.",
    ],
    cases: [
      "Ocorrências e pós-venda",
      "Cancelamentos, devoluções, reembolsos e problemas operacionais com histórico.",
    ],
    audit: [
      "Auditoria",
      "Alterações manuais de usuários, pagamentos, estoque e pedidos.",
    ],
  }[kind];
  return (
    <>
      <PageHeader title={content[0]} description={content[1]} />
      <EmptyState
        title="Nenhum registro aberto"
        description="Quando houver atividade neste domínio, a fila será exibida aqui com prioridade, responsável e prazo."
      />
    </>
  );
}
export function NewOrderPage() {
  const [products, setProducts] = useState<Product[] | null>(null),
    [cart, setCart] = useState<Record<string, number>>({}),
    [recipient, setRecipient] = useState({
      recipientName: "",
      recipientTaxId: "",
      zipCode: "",
      street: "",
      number: "",
      district: "",
      city: "",
      state: "",
    }),
    [message, setMessage] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    api<Product[]>("/products?status=ACTIVE").then(setProducts);
  }, []);
  const selected = useMemo(
    () => products?.filter((p) => cart[p.id] > 0) || [],
    [products, cart],
  );
  if (!products) return <Loading />;
  return (
    <>
      <PageHeader
        title="Novo pedido"
        description="Selecione os itens, informe um único destinatário e gere a reserva/Pix."
      />
      <div className="order-builder">
        <section className="panel">
          <h2>1. Produtos</h2>
          <label className="search-field">
            <Search />
            <input placeholder="Buscar no catálogo" />
          </label>
          <div className="catalog-picker">
            {products.map((p) => (
              <div key={p.id}>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.sku} · {p.stockOnHand - p.reservedStock} disponíveis
                  </small>
                </span>
                <input
                  aria-label={`Quantidade de ${p.name}`}
                  type="number"
                  min="0"
                  max={p.stockOnHand - p.reservedStock}
                  value={cart[p.id] || 0}
                  onChange={(e) =>
                    setCart({ ...cart, [p.id]: Number(e.target.value) })
                  }
                />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>2. Destinatário</h2>
          <div className="form-grid">
            {Object.entries(recipient).map(([k, v]) => (
              <label key={k}>
                {
                  (
                    {
                      recipientName: "Nome",
                      recipientTaxId: "CPF/CNPJ",
                      zipCode: "CEP",
                      street: "Logradouro",
                      number: "Número",
                      district: "Bairro",
                      city: "Cidade",
                      state: "UF",
                    } as Record<string, string>
                  )[k]
                }
                <input
                  value={v}
                  onChange={(e) =>
                    setRecipient({ ...recipient, [k]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div className="cart-summary">
            <ShoppingCart />
            <strong>
              {selected.reduce((a, p) => a + (cart[p.id] || 0), 0)} item(ns)
            </strong>
            <span>
              {selected
                .reduce((a, p) => a + Number(p.price) * (cart[p.id] || 0), 0)
                .toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
            </span>
          </div>
          {message && <div className="form-error">{message}</div>}
          <button
            className="primary"
            disabled={!selected.length || !recipient.recipientName}
            onClick={async () => {
              try {
                const o = await api<{ id: string }>("/orders", {
                  method: "POST",
                  body: JSON.stringify({
                    items: selected.map((p) => ({
                      productId: p.id,
                      quantity: cart[p.id],
                    })),
                    recipientName: recipient.recipientName,
                    recipientTaxId: recipient.recipientTaxId,
                    recipientAddress: {
                      zipCode: recipient.zipCode,
                      street: recipient.street,
                      number: recipient.number,
                      district: recipient.district,
                      city: recipient.city,
                      state: recipient.state,
                    },
                  }),
                });
                nav(`/operations/orders/${o.id}`);
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Falha ao criar pedido",
                );
              }
            }}
          >
            Reservar estoque e gerar Pix
          </button>
        </section>
      </div>
    </>
  );
}
