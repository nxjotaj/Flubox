'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, LoaderCircle, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AccountType = 'supplier' | 'reseller';

export function OrganizationForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [type, setType] = useState<AccountType>('reseller');
  const [displayName, setDisplayName] = useState(defaultName);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/onboarding/organization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, displayName }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? 'Não foi possível continuar.');
      router.push('/dashboard');
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível continuar.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="organization-form" onSubmit={submit}>
      <div className="onboarding-progress">
        <span className="active" />
        <span />
        <span />
        <small>Etapa 1 de 3</small>
      </div>
      <span className="eyebrow">Vamos começar</span>
      <h1>Como você vai usar a Flubox?</h1>
      <p>
        Essa escolha define sua experiência inicial. Os dados jurídicos serão
        solicitados nas próximas etapas.
      </p>
      <fieldset>
        <legend>Selecione seu perfil</legend>
        <div className="profile-options">
          <button
            type="button"
            className={type === 'reseller' ? 'selected' : ''}
            onClick={() => setType('reseller')}
            aria-pressed={type === 'reseller'}
          >
            <span>
              <ShoppingBag />
            </span>
            <strong>Quero revender</strong>
            <small>Encontre produtos e faça pedidos sem manter estoque.</small>
            {type === 'reseller' && <Check className="option-check" />}
          </button>
          <button
            type="button"
            className={type === 'supplier' ? 'selected' : ''}
            onClick={() => setType('supplier')}
            aria-pressed={type === 'supplier'}
          >
            <span>
              <Building2 />
            </span>
            <strong>Sou fornecedor</strong>
            <small>
              Publique seu estoque e receba pedidos de revendedores.
            </small>
            {type === 'supplier' && <Check className="option-check" />}
          </button>
        </div>
      </fieldset>
      <label className="form-label" htmlFor="display-name">
        {type === 'supplier' ? 'Nome da empresa' : 'Como podemos chamar você?'}
      </label>
      <Input
        id="display-name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        minLength={2}
        maxLength={120}
        required
        className="large-input"
        placeholder={type === 'supplier' ? 'Nome fantasia' : 'Seu nome'}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="continue-button"
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" /> Criando organização…
          </>
        ) : (
          'Continuar'
        )}
      </Button>
    </form>
  );
}
