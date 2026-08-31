import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { EmptyState, Loading, PageHeader, StatusBadge } from "../components/ui";
type Order = {
  id: string;
  number: string;
  status: string;
  total: number;
  recipientName: string;
  trackingCode?: string;
  createdAt: string;
  reservationExpiresAt?: string;
  seller: { name: string; companyName?: string };
  items: Array<{ sku: string; name: string; quantity: number }>;
  payments: Array<{ id: string; status: string; amount: number }>;
  files: Array<{ kind: string }>;
};
const statuses = [
  ["", "Todos"],
  ["AWAITING_PAYMENT", "Aguardando Pix"],
  ["PAYMENT_REVIEW", "Em revisão"],
  ["DOCUMENTS_PENDING", "Documentos pendentes"],
  ["PAID", "Pagos"],
  ["SEPARATING", "Em separação"],
  ["READY_TO_SHIP", "Prontos"],
  ["SHIPPED", "Enviados"],
  ["CANCELLED", "Cancelados"],
];
const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
export function OrdersPage({
  mode = "orders",
}: {
  mode?: "orders" | "payments" | "documents" | "shipping";
}) {
  const [params, setParams] = useSearchParams(),
    [items, setItems] = useState<Order[] | null>(null),
    [error, setError] = useState("");
  const nav = useNavigate(),
    status = params.get("status") || "",
    q = params.get("q") || "";
  useEffect(() => {
    api<Order[]>(`/orders${status ? `?status=${status}` : ""}`)
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [status]);
  const shown = useMemo(
    () =>
      items?.filter((o) => {
        const text = [
          o.number,
          o.recipientName,
          o.trackingCode,
          o.seller?.name,
          o.seller?.companyName,
          ...o.items.flatMap((i) => [i.sku, i.name]),
        ]
          .join(" ")
          .toLowerCase();
        if (q && !text.includes(q.toLowerCase())) return false;
        if (mode === "payments") return o.payments.length > 0;
        if (mode === "documents")
          return [
            "DOCUMENTS_PENDING",
            "PAID",
            "SEPARATING",
            "READY_TO_SHIP",
          ].includes(o.status);
        if (mode === "shipping")
          return [
            "DOCUMENTS_PENDING",
            "PAID",
            "SEPARATING",
            "READY_TO_SHIP",
            "SHIPPED",
          ].includes(o.status);
        return true;
      }) ?? [],
    [items, q, mode],
  );
  if (!items && !error) return <Loading />;
  const title = {
      orders: "Pedidos",
      payments: "Pagamentos",
      documents: "Documentos",
      shipping: "Central de expedição",
    }[mode],
    desc = {
      orders: "Todos os pedidos e seus estados operacionais.",
      payments: "Conciliação Pix, comprovantes e divergências.",
      documents: "Etiquetas, notas fiscais e declarações de conteúdo.",
      shipping: "Filas de separação, prontidão e expedição.",
    }[mode];
  return (
    <>
      <PageHeader title={title} description={desc} />
      {mode === "orders" && (
        <div className="tabs scroll-tabs">
          {statuses.map(([s, l]) => (
            <button
              className={status === s ? "active" : ""}
              key={s}
              onClick={() => setParams(q ? { status: s, q } : { status: s })}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {mode === "shipping" && (
        <div className="queue-summary">
          <button onClick={() => setParams({ status: "DOCUMENTS_PENDING" })}>
            Documentos pendentes{" "}
            <b>
              {items!.filter((x) => x.status === "DOCUMENTS_PENDING").length}
            </b>
          </button>
          <button onClick={() => setParams({ status: "SEPARATING" })}>
            Em separação{" "}
            <b>{items!.filter((x) => x.status === "SEPARATING").length}</b>
          </button>
          <button onClick={() => setParams({ status: "READY_TO_SHIP" })}>
            Prontos{" "}
            <b>{items!.filter((x) => x.status === "READY_TO_SHIP").length}</b>
          </button>
          <button onClick={() => setParams({ status: "SHIPPED" })}>
            Enviados <b>{items!.filter((x) => x.status === "SHIPPED").length}</b>
          </button>
        </div>
      )}
      <div className="toolbar">
        <label className="search-field">
          <Search />
          <input
            value={q}
            placeholder="Pedido, SKU, lojista, destinatário ou rastreio"
            onChange={(e) =>
              setParams(
                status ? { status, q: e.target.value } : { q: e.target.value },
              )
            }
          />
        </label>
        <button className="secondary">
          <SlidersHorizontal /> Filtrar e ordenar
        </button>
        <span className="toolbar-spacer" />
        <span>{shown.length} registro(s)</span>
      </div>
      {error && <div className="error-panel">{error}</div>}
      {shown.length === 0 ? (
        <EmptyState
          title="Nenhum registro nesta fila"
          description="Não há pedidos vinculados aos filtros selecionados."
          action={
            <button className="link-button" onClick={() => setParams({})}>
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Lojista / destinatário</th>
                <th>Itens</th>
                {mode === "documents" && <th>Arquivos</th>}
                {mode === "payments" && <th>Pagamento</th>}
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => nav(`/operations/orders/${o.id}`)}
                >
                  <td>
                    <strong>{o.number}</strong>
                    <small>
                      {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </small>
                  </td>
                  <td>
                    <strong>{o.seller?.companyName || o.seller?.name}</strong>
                    <small>{o.recipientName}</small>
                  </td>
                  <td>
                    {o.items.map((i) => (
                      <small key={i.sku}>
                        {i.quantity}× {i.sku}
                      </small>
                    ))}
                  </td>
                  {mode === "documents" && (
                    <td>
                      <div className="chips">
                        <span
                          className={
                            o.files.some((f) => f.kind === "SHIPPING_LABEL")
                              ? "success-chip"
                              : "warning-chip"
                          }
                        >
                          Etiqueta
                        </span>
                        <span
                          className={
                            o.files.some((f) =>
                              ["INVOICE", "CONTENT_DECLARATION"].includes(
                                f.kind,
                              ),
                            )
                              ? "success-chip"
                              : "warning-chip"
                          }
                        >
                          Fiscal
                        </span>
                      </div>
                    </td>
                  )}
                  {mode === "payments" && (
                    <td>
                      <StatusBadge>
                        {o.payments[0]?.status || "SEM COBRANÇA"}
                      </StatusBadge>
                    </td>
                  )}
                  <td>
                    <strong>{money(Number(o.total))}</strong>
                  </td>
                  <td>
                    <StatusBadge>{o.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
