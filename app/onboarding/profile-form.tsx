'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoaderCircle } from 'lucide-react';

type Props = { type: 'supplier' | 'reseller'; email: string; name: string };

export function ProfileForm({ type, email, name }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const value = (key: string) => {
      const result = data.get(key);
      return typeof result === 'string' ? result : '';
    };
    const address = {
      postalCode: value('postalCode'),
      street: value('street'),
      number: value('number'),
      complement: value('complement'),
      district: value('district'),
      city: value('city'),
      state: value('state'),
    };
    const payload =
      type === 'supplier'
        ? {
            type,
            cnpj: value('cnpj'),
            legalName: value('legalName'),
            tradeName: value('tradeName'),
            stateRegistration: value('stateRegistration'),
            responsibleName: value('responsibleName'),
            responsibleCpf: value('responsibleCpf'),
            responsibleEmail: value('responsibleEmail'),
            responsiblePhone: value('responsiblePhone'),
            address,
          }
        : {
            type,
            fullName: value('fullName'),
            cpf: value('cpf'),
            phone: value('phone'),
            address,
          };
    try {
      const response = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        next?: string;
      };
      if (!response.ok) throw new Error(result.error);
      router.push(result.next ?? '/dashboard');
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível salvar.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="onboarding-progress">
        <span className="active" />
        <span className="active" />
        <span />
        <small>Etapa 2 de 3</small>
      </div>
      <span className="eyebrow">Identificação</span>
      <h1>
        {type === 'supplier'
          ? 'Conte sobre sua empresa.'
          : 'Complete seus dados.'}
      </h1>
      <p>
        Dados obrigatórios são enviados com segurança e ficam pendentes até a
        validação correspondente.
      </p>
      <section>
        <h2>{type === 'supplier' ? 'Empresa' : 'Dados pessoais'}</h2>
        <div className="form-grid">
          {type === 'supplier' ? (
            <>
              <Field
                name="cnpj"
                label="CNPJ"
                placeholder="00.000.000/0000-00"
              />
              <Field
                name="stateRegistration"
                label="Inscrição estadual"
                placeholder="Quando aplicável"
              />
              <Field name="legalName" label="Razão social" wide />
              <Field name="tradeName" label="Nome fantasia" wide />
            </>
          ) : (
            <>
              <Field
                name="fullName"
                label="Nome completo"
                defaultValue={name}
                wide
              />
              <Field name="cpf" label="CPF" placeholder="000.000.000-00" />
              <Field
                name="phone"
                label="Telefone"
                placeholder="(00) 00000-0000"
              />
            </>
          )}
        </div>
      </section>
      {type === 'supplier' && (
        <section>
          <h2>Responsável</h2>
          <div className="form-grid">
            <Field
              name="responsibleName"
              label="Nome completo"
              defaultValue={name}
              wide
            />
            <Field name="responsibleCpf" label="CPF" />
            <Field name="responsiblePhone" label="Telefone" />
            <Field
              name="responsibleEmail"
              label="E-mail"
              type="email"
              defaultValue={email}
              wide
            />
          </div>
        </section>
      )}
      <section>
        <h2>Endereço principal</h2>
        <div className="form-grid">
          <Field name="postalCode" label="CEP" />
          <Field name="state" label="UF" maxLength={2} />
          <Field name="street" label="Logradouro" wide />
          <Field name="number" label="Número" />
          <Field name="complement" label="Complemento" required={false} />
          <Field name="district" label="Bairro" />
          <Field name="city" label="Cidade" />
        </div>
      </section>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending} className="continue-button">
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" /> Salvando…
          </>
        ) : (
          'Salvar e continuar'
        )}
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  wide = false,
  required = true,
  ...props
}: {
  name: string;
  label: string;
  wide?: boolean;
  required?: boolean;
} & React.ComponentProps<'input'>) {
  return (
    <label className={wide ? 'wide' : ''}>
      <span>{label}</span>
      <Input
        name={name}
        required={required}
        minLength={required ? 2 : undefined}
        className="large-input"
        {...props}
      />
    </label>
  );
}
