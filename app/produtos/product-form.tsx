'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
type CategoryAttribute = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  unit: string | null;
};
type Category = { id: string; name: string; attributes: CategoryAttribute[] };

export function ProductForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [variants, setVariants] = useState([{name:'',sku:'',attributes:'',price:'',stock:'0'}]);
  const [hasVariants, setHasVariants] = useState(false);
  const activeAttributes = useMemo(
    () =>
      categories.find((category) => category.id === categoryId)?.attributes ??
      [],
    [categories, categoryId],
  );
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    const value = (key: string) => {
      const item = data.get(key);
      return typeof item === 'string' ? item : '';
    };
    const cents = (key: string) =>
      Math.round(Number(value(key).replace(',', '.')) * 100);
    const attributes = Object.fromEntries(
      activeAttributes.map((attribute) => [
        attribute.key,
        value(`attribute:${attribute.key}`),
      ]),
    );
    const payload = {
      sku: value('sku'),
      title: value('title'),
      description: value('description'),
      shortDescription: value('shortDescription'),
      brand: value('brand'),
      gtin: value('gtin'),
      ncm: value('ncm'),
      netWeightGrams: Number(value('netWeightGrams')) || undefined,
      grossWeightGrams: Number(value('grossWeightGrams')),
      productHeightMm: Number(value('productHeightMm')) || undefined,
      productWidthMm: Number(value('productWidthMm')) || undefined,
      productLengthMm: Number(value('productLengthMm')) || undefined,
      packageHeightMm: Number(value('packageHeightMm')),
      packageWidthMm: Number(value('packageWidthMm')),
      packageLengthMm: Number(value('packageLengthMm')),
      composition: value('composition') || undefined,
      voltage: value('voltage') || undefined,
      categoryId: value('categoryId') || undefined,
      attributes,
      priceCents: cents('price'),
      suggestedRetailCents: cents('suggestedRetail') || undefined,
      stock: Number(value('stock')),
      preparationDays: Number(value('preparationDays')),
      variants: hasVariants ? variants.map(variant=>({name:variant.name,sku:variant.sku,attributes:Object.fromEntries(variant.attributes.split(',').map(item=>item.trim()).filter(Boolean).map(item=>{const [key,...rest]=item.split(':');return [key.trim(),rest.join(':').trim()]})),priceCents:Math.round(Number(variant.price.replace(',','.'))*100),stock:Number(variant.stock)})) : [],
    };
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as {
      error?: string;
      qualityScore?: number;
    };
    setMessage(
      response.ok
        ? `Produto salvo com qualidade ${result.qualityScore}/100.`
        : (result.error ?? 'Falha ao salvar.'),
    );
    if (response.ok) {
      event.currentTarget.reset();
      setCategoryId('');
      router.refresh();
    }
    setPending(false);
  }
  return (
    <div className="product-form-wrap">
      <Button onClick={() => setOpen(!open)}>
        {open ? 'Fechar cadastro' : 'Novo produto'}
      </Button>
      {open && (
        <form className="product-form" onSubmit={submit}>
          <Input name="sku" placeholder="SKU" required />
          <Input name="title" placeholder="Título do produto" required />
          <label>
            Categoria
            <select
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Selecione uma categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <Input name="brand" placeholder="Marca" />
          <textarea
            name="shortDescription"
            placeholder="Descrição curta para resultados e cartões (20 a 280 caracteres)"
            minLength={20}
            maxLength={280}
            required
          />
          <textarea
            name="description"
            placeholder="Descrição detalhada"
            required
          />
          <Input name="gtin" placeholder="EAN/GTIN" />
          <Input name="ncm" placeholder="NCM" />
          <Input name="netWeightGrams" type="number" min="1" placeholder="Peso líquido (g)" />
          <Input name="grossWeightGrams" type="number" min="1" placeholder="Peso bruto (g)" required />
          <Input name="productHeightMm" type="number" min="1" placeholder="Altura do produto (mm)" />
          <Input name="productWidthMm" type="number" min="1" placeholder="Largura do produto (mm)" />
          <Input name="productLengthMm" type="number" min="1" placeholder="Comprimento do produto (mm)" />
          <Input name="packageHeightMm" type="number" min="1" placeholder="Altura da embalagem (mm)" required />
          <Input name="packageWidthMm" type="number" min="1" placeholder="Largura da embalagem (mm)" required />
          <Input name="packageLengthMm" type="number" min="1" placeholder="Comprimento da embalagem (mm)" required />
          <Input name="composition" placeholder="Composição/material" />
          <Input name="voltage" placeholder="Voltagem, quando aplicável" />
          {activeAttributes.map((attribute) => (
            <label key={attribute.key}>
              {attribute.label}
              {attribute.unit ? ` (${attribute.unit})` : ''}
              {attribute.options.length ? (
                <select
                  name={`attribute:${attribute.key}`}
                  required={attribute.required}
                >
                  <option value="">Selecione</option>
                  {attribute.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  name={`attribute:${attribute.key}`}
                  type={attribute.type === 'number' ? 'number' : 'text'}
                  required={attribute.required}
                />
              )}
            </label>
          ))}
          <Input
            name="price"
            inputMode="decimal"
            placeholder="Preço, ex. 99,90"
            required
          />
          <label className="wide variant-toggle"><input type="checkbox" checked={hasVariants} onChange={event=>setHasVariants(event.target.checked)} /> Este produto possui variações de cor, tamanho, modelo ou voltagem</label>
          {hasVariants && <section className="product-variants-editor wide"><header><div><strong>Variações e SKUs</strong><small>Cada variação controla preço e estoque próprios.</small></div><button type="button" onClick={()=>setVariants(current=>[...current,{name:'',sku:'',attributes:'',price:'',stock:'0'}])}>Adicionar variação</button></header>{variants.map((variant,index)=><div key={index}><Input value={variant.name} onChange={e=>setVariants(current=>current.map((item,i)=>i===index?{...item,name:e.target.value}:item))} placeholder="Nome: Azul / 220V" required/><Input value={variant.sku} onChange={e=>setVariants(current=>current.map((item,i)=>i===index?{...item,sku:e.target.value}:item))} placeholder="SKU da variação" required/><Input value={variant.attributes} onChange={e=>setVariants(current=>current.map((item,i)=>i===index?{...item,attributes:e.target.value}:item))} placeholder="cor: Azul, voltagem: 220V"/><Input value={variant.price} onChange={e=>setVariants(current=>current.map((item,i)=>i===index?{...item,price:e.target.value}:item))} placeholder="Preço" inputMode="decimal" required/><Input value={variant.stock} onChange={e=>setVariants(current=>current.map((item,i)=>i===index?{...item,stock:e.target.value}:item))} placeholder="Estoque" type="number" min="0" required/>{variants.length>1&&<button type="button" onClick={()=>setVariants(current=>current.filter((_,i)=>i!==index))}>Remover</button>}</div>)}</section>}
          <Input
            name="suggestedRetail"
            inputMode="decimal"
            placeholder="Preço sugerido"
          />
          <Input
            name="stock"
            type="number"
            min="0"
            placeholder="Estoque físico"
            required
          />
          <Input
            name="preparationDays"
            type="number"
            min="1"
            max="30"
            placeholder="Prazo de preparação em dias"
            required
          />
          <Button disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar produto'}
          </Button>
          {message && <small>{message}</small>}
        </form>
      )}
    </div>
  );
}
