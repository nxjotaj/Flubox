'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';

export function MessageComposer({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    const response = await fetch(`/api/cases/${caseId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (response.ok) {
      setBody('');
      router.refresh();
    } else setError(result.error ?? 'Não foi possível enviar.');
  }
  return (
    <div className="message-composer">
      <label htmlFor="case-message">Mensagem</label>
      <textarea
        id="case-message"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={2000}
        placeholder="Escreva uma mensagem objetiva sobre o pedido…"
      />
      <button onClick={() => void send()} disabled={busy || !body.trim()}>
        <Send /> {busy ? 'Enviando…' : 'Enviar mensagem'}
      </button>
      {error && <output>{error}</output>}
    </div>
  );
}
