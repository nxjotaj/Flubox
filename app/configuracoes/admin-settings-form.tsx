'use client';

import { useState } from 'react';

type Settings = Record<string, string>;
const fields = [
  [
    'commission_basis_points',
    'Comissão Flubox (pontos-base; 1000 = 10%)',
    'number',
    '1000',
  ],
  [
    'supplier_monthly_fee_cents',
    'Mensalidade do fornecedor (centavos)',
    'number',
    '1990',
  ],
  [
    'subscription_grace_days',
    'Tolerância de inadimplência (dias)',
    'number',
    '7',
  ],
  ['pix_expiration_minutes', 'Expiração do PIX (minutos)', 'number', '30'],
  [
    'dispute_window_days',
    'Prazo para abertura de disputa (dias)',
    'number',
    '7',
  ],
  ['max_upload_megabytes', 'Limite de upload (MB)', 'number', '10'],
] as const;

export function AdminSettingsForm({ initial }: { initial: Settings }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage('');
    const fieldValue = (name: string, fallback = '') => {
      const item = formData.get(name);
      return typeof item === 'string' ? item : fallback;
    };
    const values = Object.fromEntries(
      fields.map(([key, , , fallback]) => [key, fieldValue(key, fallback)]),
    );
    const response = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values, reason: fieldValue('reason') }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    setMessage(
      response.ok
        ? 'Configurações salvas e registradas na auditoria.'
        : (result.error ?? 'Não foi possível salvar.'),
    );
  }
  return (
    <form className="settings-grid" action={submit}>
      {fields.map(([key, label, type, fallback]) => (
        <label key={key} htmlFor={key}>
          <span>{label}</span>
          <input
            id={key}
            name={key}
            type={type}
            min="0"
            defaultValue={initial[key] ?? fallback}
            required
          />
        </label>
      ))}
      <label className="wide" htmlFor="settings-reason">
        <span>Justificativa da alteração</span>
        <textarea
          id="settings-reason"
          name="reason"
          minLength={5}
          maxLength={500}
          required
          placeholder="Explique o motivo da mudança"
        />
      </label>
      <button className="dark" disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar configurações'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
