'use client';

import { BellPlus, BellRing } from 'lucide-react';
import { useState } from 'react';

export function FollowSupplierButton({
  supplierId,
  initial,
}: {
  supplierId: string;
  initial: boolean;
}) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const response = await fetch(`/api/suppliers/${supplierId}/follow`, {
      method: 'POST',
    });
    const body = (await response.json()) as {
      following?: boolean;
      error?: string;
    };
    if (response.ok) setFollowing(Boolean(body.following));
    else window.alert(body.error ?? 'Não foi possível atualizar o fornecedor.');
    setBusy(false);
  }
  return (
    <button
      className={following ? 'following-button active' : 'following-button'}
      disabled={busy}
      onClick={() => void toggle()}
    >
      {following ? <BellRing /> : <BellPlus />}
      {busy ? 'Atualizando…' : following ? 'Seguindo' : 'Seguir fornecedor'}
    </button>
  );
}
