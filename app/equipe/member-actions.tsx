'use client';
import { useState } from 'react';
export function MemberActions({ memberId }: { memberId: string }) {
  const [message, setMessage] = useState('');
  async function revoke() {
    if (!window.confirm('Remover o acesso deste membro?')) return;
    const response = await fetch(`/api/team/members/${memberId}`, {
      method: 'DELETE',
    });
    const data = (await response.json()) as { error?: string };
    if (response.ok) window.location.reload();
    else setMessage(data.error ?? 'Não foi possível remover.');
  }
  return (
    <div>
      <button className="member-revoke" onClick={() => void revoke()}>
        Remover acesso
      </button>
      {message && <output>{message}</output>}
    </div>
  );
}
