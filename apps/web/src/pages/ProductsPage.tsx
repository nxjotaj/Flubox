import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Grid2X2,
  List,
  PackagePlus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, download } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ActionButton, EmptyState, Loading, PageHeader, StatusBadge } from "../components/ui";
export type Product = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  price: number;
  stockOnHand: number;
  reservedStock: number;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  gtin?: string;
  ncm?: string;
  status: string;
  files: Array<{ id: string; primary: boolean }>;
};
const diagnostics = (p: Product) =>
  [
    !p.files?.length && "Sem imagem",
    p.files?.length &&
      !p.files.some((f) => f.primary) &&
      "Sem imagem principal",
    (!p.weightGrams || !p.lengthMm || !p.widthMm || !p.heightMm) &&
      "Embalagem incompleta",
    !p.ncm && "NCM ausente",
    Number(p.price) <= 0 && "Preço zerado",
    p.stockOnHand - p.reservedStock <= 0 && "Sem estoque",
  ].filter(Boolean) as string[];
const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n,
  );
export function ProductsPage({
  inventory = false,
  exportsPage = false,
}: {
  inventory?: boolean;
  exportsPage?: boolean;
}) {
  const [params, setParams] = useSearchParams(),
    [items, setItems] = useState<Product[] | null>(null),
    [view, setView] = useState<"table" | "grid">("table"),
    [error, setError] = useState("");
  const { user } = useAuth(),
    nav = useNavigate(),
    search = params.get("q") || "",
    tab = params.get("tab") || "all";
  const load = () =>
    api<Product[]>(`/products?search=${encodeURIComponent(search)}`)
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [search]);
  const filtered = useMemo(
    () =>
      items?.filter(
        (p) =>
          tab === "all" ||
          (tab === "active" && p.status === "ACTIVE") ||
          (tab === "inactive" && p.status !== "ACTIVE") ||
          (tab === "empty" && p.stockOnHand - p.reservedStock <= 0) ||
          (tab === "low" &&
            p.stockOnHand - p.reservedStock > 0 &&
            p.stockOnHand - p.reservedStock <= 5) ||
          (tab === "issues" && diagnostics(p).length > 0),
      ) ?? [],
    [items, tab],
  );
  if (!items && !error) return <Loading />;
  if (exportsPage)
    return (
      <>
        <PageHeader
          title="Importações e exportações"
          description="Extraia o catálogo com os filtros atuais ou baixe as imagens em pacote."
        />
        <section className="export-grid">
          <article className="panel">
            <Download />
            <h2>Catálogo CSV</h2>
            <p>Arquivo leve, compatível com planilhas e integrações.</p>
            <ActionButton
              tone="primary"
              aria-label="Baixar CSV"
              onClick={() =>
                void download("/exports/catalog.csv", "catalogo-flubox.csv")
              }
            >
              Baixar CSV
            </ActionButton>
          </article>
          <article className="panel">
            <Download />
            <h2>Catálogo Excel</h2>
            <p>Campos comerciais, fiscais, embalagem e estoque.</p>
            <ActionButton
              tone="primary"
              aria-label="Baixar Excel"
              onClick={() =>
                void download("/exports/catalog.xlsx", "catalogo-flubox.xlsx")
              }
            >
              Baixar Excel
            </ActionButton>
          </article>
          <article className="panel">
            <Download />
            <h2>Pacote de fotos</h2>
            <p>ZIP organizado por SKU, apenas com imagens autorizadas.</p>
            <ActionButton
              tone="primary"
              aria-label="Baixar ZIP"
              onClick={() =>
                void download("/exports/catalog-images.zip", "fotos-flubox.zip")
              }
            >
              Baixar ZIP
            </ActionButton>
          </article>
        </section>
      </>
    );
  return (
    <>
      <PageHeader
        title={inventory ? "Estoque e movimentações" : "Produtos"}
        description={
          inventory
            ? "Saldos disponíveis, reservados e situação operacional."
            : "Cadastro, diagnóstico e disponibilidade do catálogo."
        }
        actions={
          user?.role !== "SELLER" && !inventory ? (
            <ActionButton
              tone="primary"
              aria-label="Novo produto"
              onClick={() => nav("/catalog/products/new")}
            >
              <PackagePlus /> Novo produto
            </ActionButton>
          ) : undefined
        }
      />
      <div className="tabs">
        {[
          ["all", "Todos"],
          ["active", "Ativos"],
          ["inactive", "Inativos"],
          ["empty", "Sem estoque"],
          ["low", "Estoque baixo"],
          ["issues", "Com pendências"],
        ].map(([k, l]) => (
          <button
            className={tab === k ? "active" : ""}
            key={k}
            onClick={() =>
              setParams(search ? { tab: k, q: search } : { tab: k })
            }
          >
            {l}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <label className="search-field">
          <Search />
          <input
            value={search}
            placeholder="Nome, SKU, categoria ou GTIN"
            onChange={(e) => setParams({ tab, q: e.target.value })}
          />
        </label>
        <ActionButton tone="secondary" aria-label="Filtros">
          <SlidersHorizontal /> Filtros
        </ActionButton>
        <span className="toolbar-spacer" />
        <button className="icon-button" aria-label="Visualizar produtos em tabela" onClick={() => setView("table")}>
          <List />
        </button>
        <button className="icon-button" aria-label="Visualizar produtos em grade" onClick={() => setView("grid")}>
          <Grid2X2 />
        </button>
      </div>
      {error && <div className="error-panel">{error}</div>}
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description="Altere os filtros ou cadastre o primeiro produto desta situação."
        />
      ) : view === "table" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Preço</th>
                <th>Disponível</th>
                <th>Reservado</th>
                <th>Diagnóstico</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => nav(`/catalog/products/${p.id}`)}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sku} · {p.category || "Sem categoria"}
                    </small>
                  </td>
                  <td>{money(Number(p.price))}</td>
                  <td>
                    <strong>{p.stockOnHand - p.reservedStock}</strong>
                  </td>
                  <td>{p.reservedStock}</td>
                  <td>
                    <div className="chips">
                      {diagnostics(p)
                        .slice(0, 2)
                        .map((d) => (
                          <span className="warning-chip" key={d}>
                            {d}
                          </span>
                        ))}
                      {diagnostics(p).length === 0 && (
                        <span className="success-chip">Completo</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <StatusBadge>{p.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((p) => (
            <button
              key={p.id}
              className="product-card"
              onClick={() => nav(`/catalog/products/${p.id}`)}
            >
              <div className="product-image">
                {p.files?.length ? "Imagem" : "Sem imagem"}
              </div>
              <strong>{p.name}</strong>
              <small>{p.sku}</small>
              <b>{money(Number(p.price))}</b>
              <span>{p.stockOnHand - p.reservedStock} disponível</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
