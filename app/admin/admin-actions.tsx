'use client';
import { useState } from 'react';
export function AdminMaintenance() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  async function run(path: string, label: string) {
    setBusy(label);
    setMessage('');
    const response = await fetch(path, { method: 'POST' });
    const data = (await response.json()) as Record<string, unknown> & {
      error?: string;
    };
    setBusy('');
    const quantity = Number(
      data.recalculated ?? data.evaluated ?? data.expired ?? 0,
    );
    setMessage(
      response.ok
        ? `${label} concluído. ${quantity} registro(s) processado(s).`
        : (data.error ?? 'Falha na operação.'),
    );
  }
  return (
    <div className="admin-actions">
      <button
        disabled={Boolean(busy)}
        onClick={() =>
          void run('/api/admin/reputation/recalculate', 'Reputações')
        }
      >
        {busy === 'Reputações' ? 'Recalculando…' : 'Recalcular reputações'}
      </button>
      <button
        disabled={Boolean(busy)}
        onClick={() =>
          void run('/api/admin/subscriptions/evaluate', 'Assinaturas')
        }
      >
        {busy === 'Assinaturas' ? 'Avaliando…' : 'Avaliar assinaturas'}
      </button>
      <button
        disabled={Boolean(busy)}
        onClick={() => void run('/api/admin/orders/expire', 'Pedidos')}
      >
        {busy === 'Pedidos' ? 'Verificando…' : 'Expirar reservas vencidas'}
      </button>
      {message && <output>{message}</output>}
    </div>
  );
}
export function ModerationActions({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const [message, setMessage] = useState('');
  async function decide(decision: 'approved' | 'suspended') {
    const justification = window.prompt(
      'Justificativa da decisão (mínimo 5 caracteres):',
    );
    if (!justification) return;
    const response = await fetch(
      `/api/admin/products/${productId}/moderation`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: justification }),
      },
    );
    const data = (await response.json()) as { error?: string };
    if (response.ok) window.location.reload();
    else setMessage(data.error ?? 'Falha na moderação.');
  }
  return (
    <div className="admin-actions">
      {status === 'suspended' ? (
        <button onClick={() => void decide('approved')}>
          Restaurar publicação
        </button>
      ) : (
        <button className="danger" onClick={() => void decide('suspended')}>
          Suspender publicação
        </button>
      )}
      {message && <output>{message}</output>}
    </div>
  );
}
