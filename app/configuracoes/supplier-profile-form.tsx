'use client';

import { Building2, MapPin, Save, UserRound } from 'lucide-react';
import { useState } from 'react';

export type SupplierSettingsProfile = {
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  responsibleName: string;
  responsibleCpf: string;
  responsibleEmail: string;
  responsiblePhone: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  publicProfileEnabled: boolean;
  hasLogo: boolean;
};

export function SupplierLogoForm({ hasLogo }: { hasLogo: boolean }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function upload(form: FormData) {
    setBusy(true);
    const response = await fetch('/api/account/supplier-logo', {
      method: 'POST',
      body: form,
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Foto da empresa atualizada.'
        : (result.error ?? 'Não foi possível enviar.'),
    );
    setBusy(false);
    if (response.ok) location.reload();
  }
  return (
    <form className="surface-card supplier-logo-form" action={upload}>
      <div className="account-avatar-preview">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/api/account/supplier-logo" alt="Foto da empresa" />
        ) : (
          <Building2 />
        )}
      </div>
      <div>
        <h2>Foto da empresa</h2>
        <p>
          Logotipo exibido no perfil do fornecedor. JPG, PNG ou WebP de até 5
          MB.
        </p>
      </div>
      <label className="file-action">
        Escolher imagem
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <button disabled={busy}>{busy ? 'Enviando…' : 'Enviar foto'}</button>
      {message && <output>{message}</output>}
    </form>
  );
}

export function SupplierProfileForm({
  profile,
}: {
  profile: SupplierSettingsProfile;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(form: FormData) {
    setBusy(true);
    const body = Object.fromEntries(form.entries());
    body.publicProfileEnabled =
      form.get('publicProfileEnabled') === 'on' ? 'true' : 'false';
    const response = await fetch('/api/account/supplier-profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Dados do fornecedor salvos.'
        : (result.error ?? 'Não foi possível salvar.'),
    );
    setBusy(false);
  }
  return (
    <form
      className="surface-card account-profile-form settings-main-card"
      action={save}
    >
      <header>
        <Building2 />
        <div>
          <h2>Dados da empresa</h2>
          <p>Informações jurídicas, comerciais e de contato do fornecedor.</p>
        </div>
      </header>
      <label>
        Razão social
        <input name="legalName" defaultValue={profile.legalName} required />
      </label>
      <label>
        Nome fantasia
        <input name="tradeName" defaultValue={profile.tradeName} required />
      </label>
      <label>
        CNPJ
        <input name="cnpj" defaultValue={profile.cnpj} required />
      </label>
      <label>
        Inscrição estadual
        <input
          name="stateRegistration"
          defaultValue={profile.stateRegistration}
        />
      </label>
      <h3>
        <UserRound /> Responsável
      </h3>
      <label>
        Nome completo
        <input
          name="responsibleName"
          defaultValue={profile.responsibleName}
          required
        />
      </label>
      <label>
        CPF
        <input
          name="responsibleCpf"
          defaultValue={profile.responsibleCpf}
          required
        />
      </label>
      <label>
        E-mail
        <input
          type="email"
          name="responsibleEmail"
          defaultValue={profile.responsibleEmail}
          required
        />
      </label>
      <label>
        Telefone
        <input
          name="responsiblePhone"
          defaultValue={profile.responsiblePhone}
          required
        />
      </label>
      <h3>
        <MapPin /> Endereço comercial
      </h3>
      <label>
        CEP
        <input name="postalCode" defaultValue={profile.postalCode} required />
      </label>
      <label className="wide">
        Rua
        <input name="street" defaultValue={profile.street} required />
      </label>
      <label>
        Número
        <input name="number" defaultValue={profile.number} required />
      </label>
      <label>
        Complemento
        <input name="complement" defaultValue={profile.complement} />
      </label>
      <label>
        Bairro
        <input name="district" defaultValue={profile.district} required />
      </label>
      <label>
        Cidade
        <input name="city" defaultValue={profile.city} required />
      </label>
      <label>
        UF
        <input
          name="state"
          maxLength={2}
          defaultValue={profile.state}
          required
        />
      </label>
      <label className="wide visibility-setting grid grid-cols-[18px_minmax(0,1fr)] items-start gap-3 rounded-xl border bg-muted/40 p-4">
        <input
          className="size-[18px] min-h-[18px] min-w-[18px] p-0"
          type="checkbox"
          name="publicProfileEnabled"
          aria-label="Exibir perfil comercial aos revendedores"
          defaultChecked={profile.publicProfileEnabled}
        />
        <span>
          <strong>Exibir perfil comercial aos revendedores</strong>
          <small>
            Mostra razão social, nome fantasia, CNPJ, telefone, e-mail e
            endereço na página pública do fornecedor.
          </small>
        </span>
      </label>
      <button disabled={busy}>
        <Save /> {busy ? 'Salvando…' : 'Salvar dados da empresa'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
