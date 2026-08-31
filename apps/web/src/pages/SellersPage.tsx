import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { EmptyState, Loading, PageHeader, StatusBadge } from "../components/ui";
type Seller = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  taxId?: string;
  status: string;
  createdAt: string;
  _count?: { orders: number };
};
export function SellersPage() {
  const [p, setP] = useSearchParams(),
    [items, setItems] = useState<Seller[] | null>(null),
    [selected, setSelected] = useState<Seller | null>(null),
    [reason, setReason] = useState("");
  const status = p.get("status") || "";
  const load = () =>
    api<Seller[]>(`/sellers${status ? `?status=${status}` : ""}`).then(
      setItems,
    );
  useEffect(() => {
    void load();
  }, [status]);
  if (!items) return <Loading />;
  return (
    <>
      <PageHeader
        title="Lojistas"
        description="Aprovação, situação cadastral e acesso à plataforma."
      />
      <div className="tabs">
        {[
          ["", "Todos"],
          ["PENDING_APPROVAL", "Aguardando aprovação"],
          ["ACTIVE", "Ativos"],
          ["SUSPENDED", "Suspensos"],
          ["REJECTED", "Rejeitados"],
        ].map(([v, l]) => (
          <button
            className={status === v ? "active" : ""}
            onClick={() => setP(v ? { status: v } : {})}
            key={v}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <label className="search-field">
          <Search />
          <input placeholder="Nome, empresa, e-mail ou documento" />
        </label>
        <span className="toolbar-spacer" />
        <span>{items.length} lojista(s)</span>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Nenhum lojista nesta situação"
          description="Novos cadastros aparecerão aqui para análise."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lojista</th>
                <th>Empresa</th>
                <th>Documento</th>
                <th>Cadastro</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => {
                    setSelected(s);
                    setReason("");
                  }}
                >
                  <td>
                    <strong>{s.name}</strong>
                    <small>{s.email}</small>
                  </td>
                  <td>{s.companyName || "Não informado"}</td>
                  <td>{s.taxId || "Não informado"}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <StatusBadge>{s.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelected(null)}>
              ×
            </button>
            <h2>{selected.name}</h2>
            <StatusBadge>{selected.status}</StatusBadge>
            <dl>
              <dt>E-mail</dt>
              <dd>{selected.email}</dd>
              <dt>Telefone</dt>
              <dd>{selected.phone || "Não informado"}</dd>
              <dt>Empresa</dt>
              <dd>{selected.companyName || "Não informada"}</dd>
              <dt>CPF/CNPJ</dt>
              <dd>{selected.taxId || "Não informado"}</dd>
            </dl>
            <label>
              Motivo da decisão
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Obrigatório para rejeitar ou suspender"
              />
            </label>
            <div className="drawer-actions">
              {selected.status !== "ACTIVE" && (
                <button
                  className="primary"
                  onClick={() =>
                    void api(`/sellers/${selected.id}/status`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        status: "ACTIVE",
                        reason: reason || "Cadastro aprovado",
                      }),
                    }).then(() => {
                      setSelected(null);
                      load();
                    })
                  }
                >
                  Aprovar / reativar
                </button>
              )}
              <button
                className="danger"
                disabled={!reason.trim()}
                onClick={() =>
                  void api(`/sellers/${selected.id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      status:
                        selected.status === "PENDING_APPROVAL"
                          ? "REJECTED"
                          : "SUSPENDED",
                      reason,
                    }),
                  }).then(() => {
                    setSelected(null);
                    load();
                  })
                }
              >
                {selected.status === "PENDING_APPROVAL"
                  ? "Rejeitar"
                  : "Suspender"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
