'use client';
import { useState } from 'react';

export function ListForm() {
  const [message, setMessage] = useState('');
  async function submit(formData: FormData) {
    const response = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: formData.get('name') }),
    });
    const data = (await response.json()) as { error?: string };
    if (response.ok) location.reload();
    else setMessage(data.error ?? 'Não foi possível criar a lista.');
  }
  return (
    <form className="new-list" action={submit}>
      <input
        name="name"
        minLength={2}
        maxLength={60}
        required
        placeholder="Ex.: Vitrine de inverno"
      />
      <button>Criar lista</button>
      {message && <small>{message}</small>}
    </form>
  );
}
