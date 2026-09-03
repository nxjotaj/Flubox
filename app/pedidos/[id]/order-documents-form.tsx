'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function UploadForm({
  orderId,
  type,
  title,
  issuerLabel,
  remainingUnits,
}: {
  orderId: string;
  type: 'shipping_label' | 'nfe_danfe' | 'content_declaration';
  title: string;
  issuerLabel: string;
  remainingUnits?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage('');
    formData.set('type', type);
    const response = await fetch(`/api/orders/${orderId}/documents`, {
      method: 'POST',
      body: formData,
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? `${title} enviado com segurança.`
        : (result.error ?? 'Falha no envio.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <form className="document-upload-card" action={submit}>
      <h3>{title}</h3>
      <label>
        {issuerLabel}
        <input name="issuer" required minLength={2} />
      </label>
      {type !== 'shipping_label' && (
        <>
          <label>
            Número (quando houver)
            <input name="number" />
          </label>
          <label>
            Data de emissão
            <input name="issuedAt" type="date" />
          </label>
        </>
      )}
      {type === 'shipping_label' && (
        <>
          <label>
            Quantas unidades esta etiqueta cobre?
            <input name="quantityCovered" type="number" min="1" max={remainingUnits} defaultValue="1" required />
          </label>
          <label>
            Código de barras da etiqueta
            <input name="barcodeValue" placeholder="Opcional: usado na baixa por leitor" />
          </label>
        </>
      )}
      <label>
        Arquivo PDF ou imagem
        <input
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <button disabled={busy}>
        {busy ? 'Enviando…' : `Enviar ${title.toLowerCase()}`}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}

export function OrderDocumentsForm({
  orderId,
  hasLabel,
  hasFiscal,
  totalUnits,
  coveredUnits,
}: {
  orderId: string;
  hasLabel: boolean;
  hasFiscal: boolean;
  totalUnits: number;
  coveredUnits: number;
}) {
  const [fiscalType, setFiscalType] = useState<
    'nfe_danfe' | 'content_declaration'
  >('nfe_danfe');
  return (
    <section className="order-operation-card">
      <span className="eyebrow">Documentos para expedição</span>
      <h2>Complete o pacote do fornecedor</h2>
      <p>
        O fornecedor só poderá iniciar a preparação depois da etiqueta e de um
        documento fiscal.
      </p>
      <div className="document-status-grid">
        <strong className={hasLabel ? 'done' : ''}>
          {hasLabel ? '✓' : '1'} Etiquetas: {coveredUnits}/{totalUnits} unidades
        </strong>
        <strong className={hasFiscal ? 'done' : ''}>
          {hasFiscal ? '✓' : '2'} Nota ou declaração
        </strong>
      </div>
      {!hasLabel && (
        <UploadForm
          orderId={orderId}
          type="shipping_label"
          title="Etiqueta de envio"
          issuerLabel="Transportadora ou marketplace"
          remainingUnits={Math.max(1, totalUnits - coveredUnits)}
        />
      )}
      {!hasFiscal && (
        <>
          <label>
            Documento fiscal
            <select
              value={fiscalType}
              onChange={(event) =>
                setFiscalType(event.target.value as typeof fiscalType)
              }
            >
              <option value="nfe_danfe">NF-e / DANFE</option>
              <option value="content_declaration">
                Declaração de conteúdo
              </option>
            </select>
          </label>
          <UploadForm
            orderId={orderId}
            type={fiscalType}
            title={
              fiscalType === 'nfe_danfe'
                ? 'NF-e / DANFE'
                : 'Declaração de conteúdo'
            }
            issuerLabel="Emissor"
          />
        </>
      )}
    </section>
  );
}
