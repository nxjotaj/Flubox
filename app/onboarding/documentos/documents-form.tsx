'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileUp, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const types = [
  { key: 'company_registration', label: 'Comprovante de registro da empresa' },
  { key: 'responsible_identity', label: 'Documento do responsável' },
  { key: 'address_proof', label: 'Comprovante de endereço' },
];
export function DocumentsForm({
  existing,
}: {
  existing: { type: string; fileName: string; status: string }[];
}) {
  const router = useRouter();
  const [docs, setDocs] = useState(existing);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  async function upload(type: string, file: File) {
    setPending(type);
    setError('');
    const form = new FormData();
    form.set('type', type);
    form.set('file', file);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: form,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setDocs((current) => [
        { type, fileName: file.name, status: 'pending' },
        ...current.filter((item) => item.type !== type),
      ]);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha no envio.');
    } finally {
      setPending('');
    }
  }
  return (
    <section className="documents-form">
      <div className="onboarding-progress">
        <span className="active" />
        <span className="active" />
        <span className="active" />
        <small>Etapa 3 de 3</small>
      </div>
      <span className="eyebrow">Documentos</span>
      <h1>Prepare sua empresa para validação.</h1>
      <p>
        Os arquivos são privados e ficam pendentes até análise. Aceitamos PDF,
        JPG, PNG ou WebP de até 10 MB.
      </p>
      <div className="document-list">
        {types.map((type) => {
          const found = docs.find((doc) => doc.type === type.key);
          return (
            <label key={type.key} className={found ? 'uploaded' : ''}>
              <span>{found ? <Check /> : <FileUp />}</span>
              <div>
                <strong>{type.label}</strong>
                <small>
                  {found
                    ? `${found.fileName} · aguardando análise`
                    : 'Clique para selecionar um arquivo'}
                </small>
              </div>
              {pending === type.key && (
                <LoaderCircle className="animate-spin" />
              )}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                disabled={Boolean(pending)}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(type.key, file);
                }}
              />
            </label>
          );
        })}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        disabled={docs.length < 3 || Boolean(pending)}
        className="continue-button"
        onClick={() => router.push('/assinatura')}
      >
        Concluir envio
      </Button>
    </section>
  );
}
