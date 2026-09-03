'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PaymentPanel({
  orderId,
  copyPaste,
  expiresAt,
  development,
}: {
  orderId: string;
  copyPaste: string | null;
  expiresAt: string | null;
  development: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    const response = await fetch(`/api/orders/${orderId}/payment/confirm`, {
      method: 'POST',
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'PIX confirmado no ambiente de desenvolvimento.'
        : (result.error ?? 'Falha ao confirmar.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <section className="order-operation-card">
      <span className="eyebrow">Pagamento PIX</span>
      <h2>Aguardando pagamento</h2>
      {copyPaste ? (
        <>
          <label htmlFor="pix-code">PIX copia e cola</label>
          <textarea id="pix-code" readOnly value={copyPaste} />
          <p>
            Expira em{' '}
            {expiresAt
              ? new Date(expiresAt).toLocaleString('pt-BR')
              : 'prazo não informado'}
            .
          </p>
        </>
      ) : (
        <p>A cobrança ainda não foi disponibilizada.</p>
      )}
      {development && (
        <>
          <button onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Confirmando…' : 'Simular confirmação do PIX'}
          </button>
          <small>
            Simulador visível apenas em desenvolvimento. Produção exige
            confirmação do PSP.
          </small>
        </>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}
