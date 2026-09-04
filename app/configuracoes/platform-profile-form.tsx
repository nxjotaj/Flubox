'use client';

import { Building2, FileText, Save, UserRound } from 'lucide-react';
import { useState } from 'react';

export type PlatformProfile = Record<string, string> & {
  adminName: string;
  adminEmail: string;
  legalName: string;
  displayName: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export function PlatformProfileForm({ initial }: { initial: PlatformProfile }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(form: FormData) {
    setBusy(true);
    const response = await fetch('/api/admin/platform-profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = (await response.json()) as {
      error?: string;
      emailConfirmationRequired?: boolean;
    };
    setMessage(
      response.ok
        ? result.emailConfirmationRequired
          ? 'Dados salvos. Confirme o novo e-mail.'
          : 'Dados administrativos e da plataforma salvos.'
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
        <UserRound />
        <div>
          <h2>Minha conta de administrador</h2>
          <p>Seus dados de acesso e identificação.</p>
        </div>
      </header>
      <label>
        Nome completo
        <input name="adminName" defaultValue={initial.adminName} required />
      </label>
      <label>
        E-mail de acesso
        <input
          type="email"
          name="adminEmail"
          defaultValue={initial.adminEmail}
          required
        />
      </label>
      <label>
        Telefone do administrador
        <input
          name="platform_admin_phone"
          defaultValue={initial.platform_admin_phone}
        />
      </label>
      <h3>
        <Building2 /> Identidade da plataforma
      </h3>
      <label>
        Razão social
        <input name="legalName" defaultValue={initial.legalName} required />
      </label>
      <label>
        Nome da plataforma
        <input name="displayName" defaultValue={initial.displayName} required />
      </label>
      <label>
        CNPJ
        <input name="platform_cnpj" defaultValue={initial.platform_cnpj} />
      </label>
      <label>
        Telefone de suporte
        <input
          name="platform_support_phone"
          defaultValue={initial.platform_support_phone}
        />
      </label>
      <label>
        E-mail de suporte
        <input
          type="email"
          name="platform_support_email"
          defaultValue={initial.platform_support_email}
        />
      </label>
      <label>
        Site/domínio oficial
        <input
          name="platform_official_url"
          defaultValue={initial.platform_official_url}
          placeholder="https://app.flubox.com.br"
        />
      </label>
      <h3>
        <Building2 /> Endereço da plataforma
      </h3>
      <label>
        CEP
        <input name="postalCode" defaultValue={initial.postalCode} required />
      </label>
      <label className="wide">
        Rua
        <input name="street" defaultValue={initial.street} required />
      </label>
      <label>
        Número
        <input name="number" defaultValue={initial.number} required />
      </label>
      <label>
        Complemento
        <input name="complement" defaultValue={initial.complement} />
      </label>
      <label>
        Bairro
        <input name="district" defaultValue={initial.district} required />
      </label>
      <label>
        Cidade
        <input name="city" defaultValue={initial.city} required />
      </label>
      <label>
        UF
        <input
          name="state"
          maxLength={2}
          defaultValue={initial.state}
          required
        />
      </label>
      <h3>
        <FileText /> Documentos oficiais
      </h3>
      <label className="wide">
        Contrato de prestação de serviços
        <textarea
          name="platform_service_agreement"
          rows={8}
          defaultValue={initial.platform_service_agreement}
          placeholder="Texto vigente do contrato…"
        />
      </label>
      <label className="wide">
        Política de privacidade
        <textarea
          name="platform_privacy_policy"
          rows={8}
          defaultValue={initial.platform_privacy_policy}
          placeholder="Texto vigente da política…"
        />
      </label>
      <label className="wide">
        Justificativa da alteração
        <textarea name="reason" minLength={5} maxLength={500} required />
      </label>
      <button disabled={busy}>
        <Save /> {busy ? 'Salvando…' : 'Salvar identidade e documentos'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
