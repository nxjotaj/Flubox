'use client';
import { useState } from 'react';
export function PrivacyForm() {
  const [message, setMessage] = useState('');
  async function submit(formData: FormData) {
    const response = await fetch('/api/privacy/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: formData.get('type'),
        reason: formData.get('reason'),
      }),
    });
    const data = (await response.json()) as { error?: string; notice?: string };
    setMessage(
      response.ok
        ? (data.notice ?? 'Solicitação registrada.')
        : (data.error ?? 'Falha na solicitação.'),
    );
  }
  return (
    <form className="checkout-form" action={submit}>
      <label>
        Direito solicitado
        <select name="type" required>
          <option value="correction">Correção</option>
          <option value="deletion">Exclusão</option>
          <option value="restriction">Restrição de tratamento</option>
          <option value="portability">Portabilidade</option>
        </select>
      </label>
      <label className="wide">
        Justificativa
        <textarea name="reason" minLength={5} maxLength={500} required />
      </label>
      <button>Registrar solicitação</button>
      {message && <output>{message}</output>}
    </form>
  );
}
