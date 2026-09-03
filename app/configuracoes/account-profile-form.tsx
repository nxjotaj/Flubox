'use client';
import {
  Building2,
  Camera,
  Landmark,
  PauseCircle,
  Save,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Profile = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  bankAccountType: string;
  pixKey: string;
  hasAvatar: boolean;
};
export function AccountProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function avatar(form: FormData) {
    setBusy(true);
    const response = await fetch('/api/account/avatar', {
      method: 'POST',
      body: form,
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Foto atualizada com sucesso.'
        : (result.error ?? 'Falha ao atualizar a foto.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  async function save(form: FormData) {
    setBusy(true);
    const body = Object.fromEntries(form.entries());
    const response = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as {
      error?: string;
      emailConfirmationRequired?: boolean;
    };
    setMessage(
      response.ok
        ? result.emailConfirmationRequired
          ? 'Dados salvos. Confirme o novo e-mail para concluir a troca.'
          : 'Dados salvos com sucesso.'
        : (result.error ?? 'Falha ao salvar.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  async function deactivate(form: FormData) {
    if (!confirm('Sua conta ficará indisponível por 30 dias. Confirmar?'))
      return;
    setBusy(true);
    const response = await fetch('/api/account/deactivate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Conta desativada por 30 dias. Encerrando sessão…'
        : (result.error ?? 'Falha ao desativar.'),
    );
    setBusy(false);
    if (response.ok) location.assign('/auth/signout?returnTo=/');
  }
  return (
    <div className="account-settings-grid">
      <form className="surface-card account-avatar-form" action={avatar}>
        <div className="account-avatar-preview">
          {profile.hasAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/account/avatar" alt="Foto atual da conta" />
          ) : (
            <UserRound />
          )}
        </div>
        <div>
          <h2>Foto da conta</h2>
          <p>JPG, PNG ou WebP, com no máximo 5 MB.</p>
        </div>
        <label className="file-action">
          <Camera /> Escolher foto
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </label>
        <button disabled={busy}>Enviar foto</button>
      </form>
      <form className="surface-card account-profile-form" action={save}>
        <header>
          <UserRound />
          <div>
            <h2>Dados pessoais</h2>
            <p>Identificação e contato da conta.</p>
          </div>
        </header>
        <label>
          Nome completo
          <input name="name" defaultValue={profile.name} required />
        </label>
        <label>
          E-mail
          <input
            name="email"
            type="email"
            defaultValue={profile.email}
            required
          />
        </label>
        <label>
          Telefone
          <input name="phone" defaultValue={profile.phone} required />
        </label>
        <label>
          CPF
          <input name="cpf" defaultValue={profile.cpf} required />
        </label>
        <h3>
          <Building2 /> Endereço
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
        <h3>
          <Landmark /> Dados bancários
        </h3>
        <label>
          Banco
          <input name="bankName" defaultValue={profile.bankName} />
        </label>
        <label>
          Agência
          <input name="bankBranch" defaultValue={profile.bankBranch} />
        </label>
        <label>
          Conta
          <input name="bankAccount" defaultValue={profile.bankAccount} />
        </label>
        <label>
          Tipo
          <select name="bankAccountType" defaultValue={profile.bankAccountType}>
            <option value="">Selecione</option>
            <option value="checking">Corrente</option>
            <option value="savings">Poupança</option>
            <option value="payment">Pagamento</option>
          </select>
        </label>
        <label className="wide">
          Chave PIX
          <input name="pixKey" defaultValue={profile.pixKey} />
        </label>
        <button disabled={busy}>
          <Save /> {busy ? 'Salvando…' : 'Salvar minha conta'}
        </button>
        {message && <output>{message}</output>}
      </form>
      <section className="surface-card account-danger-zone">
        <PauseCircle />
        <h2>Ações da conta</h2>
        <p>
          A desativação bloqueia a operação por 30 dias. Registros financeiros e
          fiscais continuam preservados.
        </p>
        <form action={deactivate}>
          <label>
            Digite DESATIVAR
            <input name="confirmation" required />
          </label>
          <label>
            Motivo
            <textarea name="reason" minLength={5} required />
          </label>
          <button disabled={busy}>Desativar por 30 dias</button>
        </form>
        <hr />
        <p>Para exclusão e direitos LGPD, utilize a solicitação abaixo.</p>
      </section>
    </div>
  );
}
