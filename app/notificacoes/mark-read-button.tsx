'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck } from 'lucide-react';

export function MarkReadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function markRead() {
    setBusy(true);
    const response = await fetch('/api/notifications/read', { method: 'POST' });
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <button type="button" disabled={busy} onClick={() => void markRead()}>
      <CheckCheck /> {busy ? 'Atualizando…' : 'Marcar como lidas'}
    </button>
  );
}
