'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    <form
      className="privacy-request-form mt-5 grid grid-cols-1 items-end gap-5 border-t pt-5 md:grid-cols-[minmax(220px,.65fr)_minmax(320px,1.35fr)]"
      action={submit}
    >
      <label className="grid gap-2 text-sm font-semibold">
        Direito solicitado
        <select name="type" required>
          <option value="correction">Correção</option>
          <option value="deletion">Exclusão</option>
          <option value="restriction">Restrição de tratamento</option>
          <option value="portability">Portabilidade</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Justificativa
        <textarea name="reason" minLength={5} maxLength={500} required />
      </label>
      <Button className="w-fit md:col-span-2" size="lg">
        Registrar solicitação
      </Button>
      {message && <output>{message}</output>}
    </form>
  );
}
