'use client';
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function ExpenseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(form: FormData) {
    setBusy(true);
    const response = await fetch('/api/admin/finance/expenses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        category: form.get('category'),
        description: form.get('description'),
        amountCents: Math.round(
          Number(
            (typeof form.get('amount') === 'string'
              ? (form.get('amount') as string)
              : ''
            ).replace(',', '.'),
          ) * 100,
        ),
        incurredAt: form.get('incurredAt'),
        reason: form.get('reason'),
      }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Despesa contabilizada.'
        : (body.error ?? 'Falha no lançamento.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <div className="admin-create-wrap">
      <button className="primary-action" onClick={() => setOpen(!open)}>
        <PlusCircle /> Lançar despesa
      </button>
      {open && (
        <form className="admin-action-panel compact" action={submit}>
          <h2>Nova despesa operacional</h2>
          <input name="category" placeholder="Categoria" required />
          <input name="description" placeholder="Descrição" required />
          <input
            name="amount"
            inputMode="decimal"
            placeholder="Valor em R$"
            required
          />
          <input
            name="incurredAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          <textarea
            name="reason"
            placeholder="Justificativa do lançamento"
            minLength={5}
            required
          />
          <button disabled={busy}>
            {busy ? 'Registrando…' : 'Registrar despesa'}
          </button>
          {message && <output>{message}</output>}
        </form>
      )}
    </div>
  );
}
