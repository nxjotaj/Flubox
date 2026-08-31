import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { ActionButton, PageHeader } from "../components/ui";
import type { Product } from "./ProductsPage";
const blank = {
  sku: "",
  name: "",
  description: "",
  category: "",
  brand: "",
  price: 0,
  initialStock: 0,
  weightGrams: 0,
  lengthMm: 0,
  widthMm: 0,
  heightMm: 0,
  gtin: "",
  ncm: "",
  status: "ACTIVE",
};
export function ProductFormPage() {
  const { id } = useParams(),
    nav = useNavigate(),
    [form, setForm] = useState(blank),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (id)
      api<Product>(`/products/${id}`)
        .then((p) => setForm({
          sku:p.sku,name:p.name,description:p.description||'',category:p.category||'',brand:p.brand||'',
          price:Number(p.price),initialStock:0,weightGrams:p.weightGrams||0,lengthMm:p.lengthMm||0,
          widthMm:p.widthMm||0,heightMm:p.heightMm||0,gtin:p.gtin||'',ncm:p.ncm||'',status:p.status,
        }))
        .catch((e) => setMessage(e.message));
  }, [id]);
  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        value={String(form[key] ?? "")}
        onChange={(e) =>
          setForm({
            ...form,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          })
        }
      />
    </label>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { initialStock, ...editable } = form;
      await api(id ? `/products/${id}` : "/products", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(id ? editable : { ...editable, initialStock }),
      });
      nav("/catalog/products");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title={id ? "Editar produto" : "Novo produto"}
        description="Preencha os dados comerciais, fiscais e logísticos usados pelos lojistas."
        actions={
          <ActionButton
            tone="secondary"
            aria-label="Voltar"
            onClick={() => nav("/catalog/products")}
          >
            <ArrowLeft /> Voltar
          </ActionButton>
        }
      />
      <form className="form-sections" onSubmit={submit}>
        <section className="panel">
          <h2>Dados comerciais</h2>
          <div className="form-grid">
            {field("sku", "SKU")}
            {field("name", "Nome do produto")}
            {field("category", "Categoria")}
            {field("brand", "Marca")}
            {field("price", "Preço de fornecimento", "number")}
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="DRAFT">Rascunho</option>
              </select>
            </label>
            <label className="full">
              Descrição
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
          </div>
        </section>
        <section className="panel">
          <h2>Fiscal e identificação</h2>
          <div className="form-grid">
            {field("gtin", "EAN / GTIN")}
            {field("ncm", "NCM")}
          </div>
        </section>
        <section className="panel">
          <h2>Embalagem e estoque</h2>
          <div className="form-grid">
            {!id && field("initialStock", "Estoque inicial", "number")}
            {field("weightGrams", "Peso (g)", "number")}
            {field("lengthMm", "Comprimento (mm)", "number")}
            {field("widthMm", "Largura (mm)", "number")}
            {field("heightMm", "Altura (mm)", "number")}
          </div>
        </section>
        {message && <div className="form-error">{message}</div>}
        <div className="sticky-actions">
          <ActionButton
            type="button"
            tone="secondary"
            aria-label="Cancelar"
            onClick={() => nav("/catalog/products")}
          >
            Cancelar
          </ActionButton>
          <ActionButton tone="primary" type="submit" isDisabled={busy} isLoading={busy} aria-label="Salvar produto">
            <Save /> {busy ? "Salvando…" : "Salvar produto"}
          </ActionButton>
        </div>
      </form>
    </>
  );
}
