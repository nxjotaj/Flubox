import { useEffect, useState } from "react";
import { ArrowLeft, Download, PackageCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Loading, PageHeader, StatusBadge } from "../components/ui";
type Detail = {
  id: string;
  number: string;
  status: string;
  total: number;
  recipientName: string;
  recipientTaxId?: string;
  recipientAddress: Record<string, string>;
  trackingCode?: string;
  seller: { name: string; email: string; companyName?: string };
  items: Array<{
    id: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  payments: Array<{
    id: string;
    status: string;
    amount: number;
    provider: string;
    providerChargeId: string;
    reviewReason?: string;
  }>;
  files: Array<{
    id: string;
    kind: string;
    originalName: string;
    ocrStatus?: string;
  }>;
  reservations: Array<{
    id: string;
    quantity: number;
    status: string;
    expiresAt: string;
  }>;
  statusHistory: Array<{
    id: string;
    toStatus: string;
    reason: string;
    createdAt: string;
  }>;
};
export function OrderDetailPage() {
  const { id } = useParams(),
    nav = useNavigate(),
    [o, setO] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [tracking, setTracking] = useState(""),
    [notes, setNotes] = useState("");
  const load = () =>
    api<Detail>(`/orders/${id}`)
      .then(setO)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [id]);
  if (!o && !error) return <Loading />;
  if (error) return <div className="error-panel">{error}</div>;
  return (
    <>
      <PageHeader
        title={o!.number}
        description={`${o!.seller.companyName || o!.seller.name} · ${o!.recipientName}`}
        actions={
          <>
            <button
              className="secondary"
              onClick={() => nav("/operations/orders")}
            >
              <ArrowLeft /> Voltar
            </button>
            <StatusBadge>{o!.status}</StatusBadge>
          </>
        }
      />
      <div className="detail-grid">
        <section className="panel wide">
          <h2>Itens do pedido</h2>
          <div className="data-list">
            {o!.items.map((i) => (
              <div className="static-row" key={i.id}>
                <span>
                  <strong>{i.name}</strong>
                  <small>{i.sku}</small>
                </span>
                <span>
                  <strong>{i.quantity} unidade(s)</strong>
                  <small>
                    {Number(i.unitPrice).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}{" "}
                    cada
                  </small>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Destinatário</h2>
          <dl>
            <dt>Nome</dt>
            <dd>{o!.recipientName}</dd>
            <dt>Documento</dt>
            <dd>{o!.recipientTaxId || "Não informado"}</dd>
            {Object.entries(o!.recipientAddress || {}).map(([k, v]) => (
              <span key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </span>
            ))}
          </dl>
        </section>
        <section className="panel">
          <h2>Pagamento Pix</h2>
          {o!.payments.map((p) => (
            <div key={p.id}>
              <StatusBadge>{p.status}</StatusBadge>
              <dl>
                <dt>Valor</dt>
                <dd>
                  {Number(p.amount).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </dd>
                <dt>Provedor</dt>
                <dd>{p.provider}</dd>
                <dt>Identificador</dt>
                <dd>{p.providerChargeId}</dd>
                {p.reviewReason && (
                  <>
                    <dt>Divergência</dt>
                    <dd>{p.reviewReason}</dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Documentos</h2>
          {o!.files.length === 0 ? (
            <p>Nenhum documento anexado.</p>
          ) : (
            o!.files.map((f) => (
              <button
                className="file-row"
                key={f.id}
                onClick={async () => {
                  const x = await api<{ url: string }>(`/files/${f.id}/url`);
                  open(x.url, "_blank");
                }}
              >
                <Download />
                <span>
                  <strong>{f.originalName}</strong>
                  <small>
                    {f.kind} · OCR {f.ocrStatus || "não processado"}
                  </small>
                </span>
              </button>
            ))
          )}
        </section>
        <section className="panel">
          <h2>Registrar expedição</h2>
          <label>
            Código de rastreio
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </label>
          <label>
            Observações
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button
            className="primary"
            onClick={async () => {
              try {
                await api(`/orders/${o!.id}/ship`, {
                  method: "PATCH",
                  body: JSON.stringify({ trackingCode: tracking, notes }),
                });
                load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Falha ao expedir");
              }
            }}
          >
            <PackageCheck /> Confirmar expedição
          </button>
        </section>
        <section className="panel wide">
          <h2>Histórico</h2>
          <div className="timeline">
            {o!.statusHistory.map((h) => (
              <div key={h.id}>
                <i />
                <span>
                  <strong>{h.toStatus}</strong>
                  <small>
                    {h.reason} · {new Date(h.createdAt).toLocaleString("pt-BR")}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
