'use client';
import { useState } from 'react';

export function FavoriteButton({
  productId,
  initial,
}: {
  productId: string;
  initial: boolean;
}) {
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const response = await fetch(`/api/favorites/${productId}`, {
      method: 'POST',
    });
    const data = (await response.json()) as { favorited?: boolean };
    if (response.ok) setActive(Boolean(data.favorited));
    setBusy(false);
  }
  return (
    <button className="catalog-action" disabled={busy} onClick={toggle}>
      {active ? '✓ Produto vinculado' : '+ Vincular produto'}
    </button>
  );
}

export function AddToCartButton({
  productId,
  variantId,
}: {
  productId: string;
  variantId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function add() {
    setBusy(true);
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId, variantId, quantity: 1 }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    setMessage(
      response.ok
        ? 'Adicionado ao carrinho.'
        : (result.error ?? 'Falha ao adicionar.'),
    );
  }
  return (
    <div className="cart-inline-action">
      <button disabled={busy} onClick={() => void add()}>
        {busy ? 'Adicionando…' : 'Adicionar ao carrinho'}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}

export function ListPicker({
  productId,
  lists,
}: {
  productId: string;
  lists: { id: string; name: string }[];
}) {
  const [message, setMessage] = useState('');
  async function add(listId: string) {
    if (!listId) return;
    const response = await fetch(`/api/lists/${listId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    setMessage(
      response.ok ? 'Adicionado à lista.' : 'Não foi possível adicionar.',
    );
  }
  return (
    <div className="list-picker">
      <select
        aria-label="Adicionar à lista"
        defaultValue=""
        onChange={(event) => void add(event.target.value)}
      >
        <option value="" disabled>
          Adicionar à lista…
        </option>
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
      {message && <small>{message}</small>}
    </div>
  );
}
