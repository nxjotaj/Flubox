'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CheckoutForm({
  productId,
  variantId,
  items,
}: {
  productId?: string;
  variantId?: string;
  items?: { productId: string; quantity: number }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage('');
    const value = (name: string) => {
      const entry = formData.get(name);
      return typeof entry === 'string' ? entry : '';
    };
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: items ?? [
          {
            productId: productId!,
            variantId,
            quantity: Number(value('quantity')),
          },
        ],
        channel: value('channel'),
        externalReference: value('externalReference') || undefined,
        recipient: {
          name: value('name'),
          document: value('document'),
          phone: value('phone'),
        },
        address: {
          postalCode: value('postalCode'),
          street: value('street'),
          number: value('number'),
          complement: value('complement') || undefined,
          district: value('district'),
          city: value('city'),
          state: value('state').toUpperCase(),
        },
        notes: value('notes') || undefined,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      number?: string;
      payment?: { message: string };
      id?: string;
    };
    setMessage(
      response.ok
        ? `Pedido ${data.number} criado. ${data.payment?.message ?? ''}`
        : (data.error ?? 'Não foi possível criar o pedido.'),
    );
    setBusy(false);
    if (response.ok && data.id) router.push(`/pedidos/${data.id}`);
  }
  return (
    <form className="checkout-form" action={submit}>
      {!items && (
        <label>
          Quantidade
          <input
            name="quantity"
            type="number"
            min="1"
            max="100"
            defaultValue="1"
            required
          />
        </label>
      )}
      <label>
        Canal/marketplace
        <input
          name="channel"
          placeholder="Mercado Livre, Shopee, loja própria…"
          required
        />
      </label>
      <label>
        Referência externa
        <input name="externalReference" />
      </label>
      <h2>Destinatário</h2>
      <label>
        Nome completo
        <input name="name" required />
      </label>
      <label>
        CPF/CNPJ
        <input name="document" required />
      </label>
      <label>
        Telefone
        <input name="phone" required />
      </label>
      <h2>Endereço de entrega</h2>
      <label>
        CEP
        <input name="postalCode" required />
      </label>
      <label className="wide">
        Rua
        <input name="street" required />
      </label>
      <label>
        Número
        <input name="number" required />
      </label>
      <label>
        Complemento
        <input name="complement" />
      </label>
      <label>
        Bairro
        <input name="district" required />
      </label>
      <label>
        Cidade
        <input name="city" required />
      </label>
      <label>
        UF
        <input name="state" minLength={2} maxLength={2} required />
      </label>
      <label className="wide">
        Observações
        <textarea name="notes" maxLength={500} />
      </label>
      <button disabled={busy}>
        {busy ? 'Criando…' : 'Reservar e criar pedido'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
