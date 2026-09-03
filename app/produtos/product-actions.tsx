'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
export function ProductActions({ id }: { id: string }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  async function adjust() {
    const quantity = Number(
      prompt('Quantidade do ajuste (use negativo para saída):'),
    );
    if (!Number.isInteger(quantity) || quantity === 0) return;
    const reason = prompt('Justificativa do ajuste:') ?? '';
    const response = await fetch(`/api/products/${id}/inventory`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity, reason }),
    });
    const result = (await response.json()) as {
      error?: string;
      stock?: number;
    };
    setMessage(
      response.ok
        ? `Estoque atualizado para ${result.stock}.`
        : (result.error ?? 'Falha.'),
    );
    if (response.ok) router.refresh();
  }
  async function media(file: File) {
    const altText = prompt('Descreva a imagem para acessibilidade:') ?? '';
    const form = new FormData();
    form.set('file', file);
    form.set('altText', altText);
    const response = await fetch(`/api/products/${id}/media`, {
      method: 'POST',
      body: form,
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Imagem armazenada com segurança.'
        : (result.error ?? 'Falha.'),
    );
  }
  return (
    <div className="product-actions">
      <a className="product-edit-link" href={`/produtos/${id}`}>
        Editar produto
      </a>
      <Button variant="outline" size="sm" onClick={() => void adjust()}>
        Ajustar estoque
      </Button>
      <Button variant="outline" size="sm">
        Adicionar imagem
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void media(file);
          }}
        />
      </Button>
      {message && <small>{message}</small>}
    </div>
  );
}
