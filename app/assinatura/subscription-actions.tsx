'use client';

import { CreditCard, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaymentMethodForm } from './payment-method-form';

export function SubscriptionActions({
  active,
  cancellationScheduled,
}: {
  active: boolean;
  cancellationScheduled: boolean;
}) {
  const router = useRouter();
  const [editingCard, setEditingCard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function command(action: 'cancel' | 'reactivate') {
    if (
      action === 'cancel' &&
      !confirm(
        'Cancelar a renovação da assinatura ao final do período já pago?',
      )
    )
      return;
    setBusy(true);
    const response = await fetch('/api/billing/subscription', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? action === 'cancel'
          ? 'Cancelamento agendado.'
          : 'Renovação reativada.'
        : (result.error ?? 'Não foi possível concluir.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <section className="surface-card subscription-actions-card">
      <div>
        <h2>Ações da assinatura</h2>
        <p>Gerencie cobrança, renovação e cancelamento.</p>
      </div>
      <div className="subscription-actions">
        {active && (
          <button
            className="secondary-action"
            onClick={() => setEditingCard((value) => !value)}
          >
            <CreditCard /> Alterar cartão de cobrança
          </button>
        )}
        {active && !cancellationScheduled && (
          <button
            className="danger-outline"
            disabled={busy}
            onClick={() => void command('cancel')}
          >
            <XCircle /> Cancelar renovação
          </button>
        )}
        {active && cancellationScheduled && (
          <button
            className="secondary-action"
            disabled={busy}
            onClick={() => void command('reactivate')}
          >
            <RotateCcw /> Manter assinatura ativa
          </button>
        )}
      </div>
      {editingCard && (
        <div className="subscription-card-editor">
          <h3>Novo cartão</h3>
          <PaymentMethodForm
            mode="replace"
            onSuccess={() => setEditingCard(false)}
          />
        </div>
      )}
      {message && <output>{message}</output>}
    </section>
  );
}
