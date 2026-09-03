'use client';
import { useState } from 'react';
export function AcceptInvitation({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    const response = await fetch('/api/team/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = (await response.json()) as { error?: string };
    if (response.ok) window.location.assign('/dashboard');
    else setMessage(data.error ?? 'Não foi possível aceitar o convite.');
    setBusy(false);
  }
  return (
    <div className="invite-accept">
      <button onClick={() => void accept()} disabled={busy}>
        {busy ? 'Aceitando…' : 'Aceitar convite'}
      </button>
      {message && <output>{message}</output>}
    </div>
  );
}
