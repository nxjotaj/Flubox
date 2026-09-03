'use client';

import { useState } from 'react';

const choices = [
  ['products.view', 'Ver catálogo'],
  ['products.manage', 'Gerenciar catálogo e estoque'],
  ['orders.view', 'Ver pedidos'],
  ['orders.manage', 'Gerenciar pedidos'],
  ['fulfillment.view', 'Ver separação'],
  ['fulfillment.manage', 'Separar, imprimir e enviar'],
  ['payments.view', 'Ver financeiro'],
  ['audit.view', 'Ver relatórios e auditoria'],
] as const;

export function PermissionEditor({ memberId, initial }: { memberId: string; initial: string[] }) {
  const [selected, setSelected] = useState(new Set(initial));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const response = await fetch(`/api/team/members/${memberId}/permissions`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: [...selected] }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(response.ok ? 'Permissões salvas.' : body.error ?? 'Falha ao salvar.');
    setBusy(false);
  }
  return <details className="permission-editor">
    <summary>Configurar permissões</summary>
    <div>{choices.map(([key,label]) => <label key={key}><input type="checkbox" checked={selected.has(key)} onChange={(event) => { const next=new Set(selected); if(event.target.checked) next.add(key); else next.delete(key); setSelected(next); }} /> {label}</label>)}</div>
    <button disabled={busy} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar permissões'}</button>
    {message && <output>{message}</output>}
  </details>;
}
