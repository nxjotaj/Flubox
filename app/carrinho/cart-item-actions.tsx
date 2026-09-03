'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function CartItemActions({
  productId,
  quantity,
  variantId,
}: {
  productId: string;
  quantity: number;
  variantId:string|null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function update(next: number) {
    setBusy(true);
    await fetch('/api/cart', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId, variantId:variantId??undefined, quantity: next }),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="cart-item-actions">
      <button
        disabled={busy || quantity <= 1}
        onClick={() => void update(quantity - 1)}
      >
        −
      </button>
      <span>{quantity}</span>
      <button disabled={busy} onClick={() => void update(quantity + 1)}>
        +
      </button>
      <button disabled={busy} className="remove" onClick={() => void update(0)}>
        Remover
      </button>
    </div>
  );
}
