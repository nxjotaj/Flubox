'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { labelFor } from '@/lib/presentation';

type Variant = {
  id?: string;
  name: string;
  sku: string;
  gtin: string | null;
  attributes: Record<string, string>;
  priceCents: number;
  retailCents: number | null;
  stock: number;
};
type Product = {
  title: string;
  description: string;
  shortDescription: string | null;
  brand: string | null;
  gtin: string | null;
  ncm: string | null;
  netWeightGrams: number | null;
  grossWeightGrams: number | null;
  productHeightMm: number | null;
  productWidthMm: number | null;
  productLengthMm: number | null;
  packageHeightMm: number | null;
  packageWidthMm: number | null;
  packageLengthMm: number | null;
  composition: string | null;
  voltage: string | null;
  priceCents: number;
  retailCents: number | null;
  preparationDays: number;
};

export function EditProductForm({
  id,
  product,
  variants: initialVariants,
}: {
  id: string;
  product: Product;
  variants: Variant[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [variants, setVariants] = useState<Variant[]>(
    initialVariants.length
      ? initialVariants
      : [
          {
            name: 'Padrão',
            sku: 'PADRAO',
            gtin: product.gtin,
            attributes: {},
            priceCents: product.priceCents,
            retailCents: product.retailCents,
            stock: 0,
          },
        ],
  );
  const update = (index: number, patch: Partial<Variant>) =>
    setVariants((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage('');
    const value = (key: string) => {
      const item = formData.get(key);
      return typeof item === 'string' ? item : '';
    };
    const integer = (key: string) => {
      const parsed = Number(value(key));
      return parsed > 0 ? parsed : undefined;
    };
    const cents = (key: string) => {
      const parsed = Math.round(Number(value(key).replace(',', '.')) * 100);
      return parsed > 0 ? parsed : undefined;
    };
    const response = await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: value('title'),
        description: value('description'),
        shortDescription: value('shortDescription'),
        brand: value('brand') || undefined,
        gtin: value('gtin') || undefined,
        ncm: value('ncm') || undefined,
        netWeightGrams: integer('netWeightGrams'),
        grossWeightGrams: integer('grossWeightGrams'),
        productHeightMm: integer('productHeightMm'),
        productWidthMm: integer('productWidthMm'),
        productLengthMm: integer('productLengthMm'),
        packageHeightMm: integer('packageHeightMm'),
        packageWidthMm: integer('packageWidthMm'),
        packageLengthMm: integer('packageLengthMm'),
        composition: value('composition') || undefined,
        voltage: value('voltage') || undefined,
        priceCents: cents('price'),
        suggestedRetailCents: cents('retail'),
        preparationDays: Number(value('preparationDays')),
        variants,
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      qualityScore?: number;
      status?: string;
    };
    setBusy(false);
    setMessage(
      response.ok
        ? `Produto atualizado: ${result.qualityScore}/100 · ${labelFor(result.status)}.`
        : (result.error ?? 'Falha ao atualizar.'),
    );
    if (response.ok) router.refresh();
  }
  const numberField = (
    name: string,
    label: string,
    current: number | null,
    required = false,
  ) => (
    <label>
      {label}
      <input
        name={name}
        type="number"
        min="1"
        defaultValue={current ?? ''}
        required={required}
      />
    </label>
  );
  return (
    <form className="product-form edit" action={submit}>
      <label>
        Título
        <input name="title" defaultValue={product.title} required />
      </label>
      <label>
        Marca
        <input name="brand" defaultValue={product.brand ?? ''} />
      </label>
      <label className="wide">
        Descrição curta
        <textarea
          name="shortDescription"
          minLength={20}
          maxLength={280}
          defaultValue={product.shortDescription ?? ''}
          required
        />
      </label>
      <label className="wide">
        Descrição completa
        <textarea
          name="description"
          minLength={100}
          defaultValue={product.description}
          required
        />
      </label>
      <label>
        EAN/GTIN
        <input name="gtin" defaultValue={product.gtin ?? ''} />
      </label>
      <label>
        NCM
        <input name="ncm" defaultValue={product.ncm ?? ''} />
      </label>
      {numberField(
        'netWeightGrams',
        'Peso líquido (g)',
        product.netWeightGrams,
      )}
      {numberField(
        'grossWeightGrams',
        'Peso bruto (g)',
        product.grossWeightGrams,
        true,
      )}
      {numberField(
        'productHeightMm',
        'Altura do produto (mm)',
        product.productHeightMm,
      )}
      {numberField(
        'productWidthMm',
        'Largura do produto (mm)',
        product.productWidthMm,
      )}
      {numberField(
        'productLengthMm',
        'Comprimento do produto (mm)',
        product.productLengthMm,
      )}
      {numberField(
        'packageHeightMm',
        'Altura da embalagem (mm)',
        product.packageHeightMm,
        true,
      )}
      {numberField(
        'packageWidthMm',
        'Largura da embalagem (mm)',
        product.packageWidthMm,
        true,
      )}
      {numberField(
        'packageLengthMm',
        'Comprimento da embalagem (mm)',
        product.packageLengthMm,
        true,
      )}
      <label>
        Composição/material
        <input name="composition" defaultValue={product.composition ?? ''} />
      </label>
      <label>
        Voltagem
        <input name="voltage" defaultValue={product.voltage ?? ''} />
      </label>
      <label>
        Preço base
        <input
          name="price"
          inputMode="decimal"
          defaultValue={(product.priceCents / 100).toFixed(2).replace('.', ',')}
          required
        />
      </label>
      <label>
        Preço sugerido
        <input
          name="retail"
          inputMode="decimal"
          defaultValue={
            product.retailCents
              ? (product.retailCents / 100).toFixed(2).replace('.', ',')
              : ''
          }
        />
      </label>
      <label>
        Prazo de preparação
        <input
          name="preparationDays"
          type="number"
          min="1"
          max="30"
          defaultValue={product.preparationDays}
          required
        />
      </label>
      <section className="product-variants-editor wide">
        <header>
          <div>
            <strong>Variações, preço e estoque</strong>
            <small>
              Produtos sem opções usam uma variação “Padrão”. Referências
              antigas são preservadas.
            </small>
          </div>
          <button
            type="button"
            onClick={() =>
              setVariants((current) => [
                ...current,
                {
                  name: '',
                  sku: '',
                  gtin: null,
                  attributes: {},
                  priceCents: product.priceCents,
                  retailCents: null,
                  stock: 0,
                },
              ])
            }
          >
            Adicionar variação
          </button>
        </header>
        {variants.map((variant, index) => (
          <div key={variant.id ?? index}>
            <input
              value={variant.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Nome"
              required
            />
            <input
              value={variant.sku}
              onChange={(e) => update(index, { sku: e.target.value })}
              placeholder="SKU"
              required
            />
            <input
              value={Object.entries(variant.attributes)
                .map(([key, val]) => `${key}: ${val}`)
                .join(', ')}
              onChange={(e) =>
                update(index, {
                  attributes: Object.fromEntries(
                    e.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .map((item) => {
                        const [key, ...rest] = item.split(':');
                        return [key.trim(), rest.join(':').trim()];
                      }),
                  ),
                })
              }
              placeholder="cor: Azul, tamanho: M"
            />
            <input
              value={(variant.priceCents / 100).toFixed(2).replace('.', ',')}
              onChange={(e) =>
                update(index, {
                  priceCents: Math.round(
                    Number(e.target.value.replace(',', '.')) * 100,
                  ),
                })
              }
              inputMode="decimal"
              placeholder="Preço"
            />
            <input
              value={variant.stock}
              onChange={(e) => update(index, { stock: Number(e.target.value) })}
              type="number"
              min="0"
              placeholder="Estoque"
            />
            {variants.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setVariants((current) =>
                    current.filter((_, i) => i !== index),
                  )
                }
              >
                Arquivar
              </button>
            )}
          </div>
        ))}
      </section>
      <button disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar produto completo'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
