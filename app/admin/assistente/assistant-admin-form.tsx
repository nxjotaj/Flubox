'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';

export function AssistantAdminForm({
  userLimit,
  organizationLimit,
}: {
  userLimit: number;
  organizationLimit: number;
}) {
  const [status, setStatus] = useState('');
  async function save(event: {
    preventDefault(): void;
    currentTarget: HTMLFormElement;
  }) {
    event.preventDefault();
    setStatus('Salvando...');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch('/api/admin/assistant/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    setStatus(
      response.ok ? 'Limites atualizados com segurança.' : result.error,
    );
  }
  return (
    <form className="settings-grid assistant-admin-settings" onSubmit={save}>
      <label>
        Mensagens por usuário ao dia
        <input
          name="userLimit"
          type="number"
          min="1"
          max="500"
          defaultValue={userLimit}
        />
      </label>
      <label>
        Mensagens por organização ao dia
        <input
          name="organizationLimit"
          type="number"
          min="1"
          max="5000"
          defaultValue={organizationLimit}
        />
      </label>
      <button className="dark wide" type="submit">
        <Save /> Salvar limites gratuitos
      </button>
      {status && <output>{status}</output>}
    </form>
  );
}
