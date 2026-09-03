'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const states = [
  'awaiting_payment',
  'payment_expired',
  'paid_awaiting_documents',
  'ready_for_supplier',
  'preparing',
  'ready_to_ship',
  'shipped',
  'in_transit',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
  'returning',
  'refunded',
  'lost',
  'logistics_failed',
];
export function AdminOrderControls({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(form: FormData) {
    setBusy(true);
    const response = await fetch(`/api/admin/orders/${orderId}/intervene`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: form.get('status'),
        reason: form.get('reason'),
        note: form.get('note') || undefined,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Intervenção registrada na timeline e auditoria.'
        : (result.error ?? 'Falha na intervenção.'),
    );
    setBusy(false);
    if (response.ok) {
      router.refresh();
      setOpen(false);
    }
  }
  return (
    <section className="order-operation-card admin-intervention">
      <header>
        <div>
          <h2>Intervenção administrativa</h2>
          <p>
            Corrija o fluxo somente quando a operação exigir. A decisão fica
            auditada.
          </p>
        </div>
        <button className="secondary-action" onClick={() => setOpen(!open)}>
          {open ? 'Fechar' : 'Intervir no pedido'}
        </button>
      </header>
      {open && (
        <form action={submit}>
          <label>
            Novo status
            <select name="status" defaultValue={status}>
              {states.map((item) => (
                <option value={item} key={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Justificativa
            <textarea
              name="reason"
              minLength={8}
              required
              placeholder="Motivo operacional da intervenção"
            />
          </label>
          <label className="wide">
            Observação visível no pedido
            <textarea name="note" placeholder="Opcional" />
          </label>
          <button disabled={busy}>
            {busy ? 'Registrando…' : 'Confirmar intervenção'}
          </button>
        </form>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}
