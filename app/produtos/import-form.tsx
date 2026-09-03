'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet } from 'lucide-react';
export function ImportForm() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  async function upload(file: File) {
    setPending(true);
    const form = new FormData();
    form.set('file', file);
    const response = await fetch('/api/imports/products', {
      method: 'POST',
      body: form,
    });
    const result = (await response.json()) as {
      error?: string;
      imported?: number;
      pending?: number;
      rejected?: number;
    };
    setMessage(
      response.ok
        ? `${result.imported} enviados para revisão, ${result.pending} rascunhos e ${result.rejected} rejeitados.`
        : (result.error ?? 'Falha na importação.'),
    );
    if (response.ok) router.refresh();
    setPending(false);
  }
  return (
    <div className="import-box">
      <FileSpreadsheet />
      <div>
        <strong>Importar planilha XLSX</strong>
        <small>
          Colunas: sku, titulo, descricao, preco, estoque e prazo_dias. Máximo
          de 500 produtos.
        </small>
      </div>
      <Button disabled={pending}>
        {pending ? 'Processando…' : 'Selecionar XLSX'}
        <input
          type="file"
          accept=".xlsx"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </Button>
      {message && <p>{message}</p>}
    </div>
  );
}
