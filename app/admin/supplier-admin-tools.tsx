'use client';
import { Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateSupplier() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  async function submit(form: FormData) {
    setBusy(true);
    const get = (key: string) => {
      const item = form.get(key);
      return typeof item === 'string' ? item : '';
    };
    const response = await fetch('/api/admin/suppliers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        legalName: get('legalName'),
        tradeName: get('tradeName'),
        cnpj: get('cnpj'),
        responsibleName: get('responsibleName'),
        responsibleCpf: get('responsibleCpf'),
        email: get('email'),
        phone: get('phone'),
        monthlyExempt: form.get('monthlyExempt') === 'on',
        commissionExempt: form.get('commissionExempt') === 'on',
        exemptionEndsAt: get('exemptionEndsAt') || undefined,
        reason: get('reason') || undefined,
      }),
    });
    const body = (await response.json()) as {
      error?: string;
      activationPath?: string;
    };
    setMessage(
      response.ok
        ? 'Fornecedor criado e convite preparado.'
        : (body.error ?? 'Falha ao criar fornecedor.'),
    );
    if (response.ok && body.activationPath) {
      setLink(`${location.origin}${body.activationPath}`);
      router.refresh();
    }
    setBusy(false);
  }
  return (
    <div className="admin-create-wrap">
      <button className="primary-action" onClick={() => setOpen(!open)}>
        <Plus /> Novo fornecedor
      </button>
      {open && (
        <div className="admin-action-panel">
          <header>
            <div>
              <small>Cadastro administrativo</small>
              <h2>Novo fornecedor</h2>
            </div>
            <button onClick={() => setOpen(false)}>Fechar</button>
          </header>
          <form action={submit}>
            <input name="legalName" placeholder="Razão social" required />
            <input name="tradeName" placeholder="Nome fantasia" required />
            <input name="cnpj" placeholder="CNPJ" required />
            <input name="responsibleName" placeholder="Responsável" required />
            <input
              name="responsibleCpf"
              placeholder="CPF do responsável"
              required
            />
            <input
              name="email"
              type="email"
              placeholder="E-mail do proprietário"
              required
            />
            <input name="phone" placeholder="Telefone" required />
            <label>
              <input name="monthlyExempt" type="checkbox" /> Isentar mensalidade
            </label>
            <label>
              <input name="commissionExempt" type="checkbox" /> Isentar comissão
            </label>
            <input name="exemptionEndsAt" type="date" />
            <textarea
              name="reason"
              placeholder="Justificativa para eventual isenção"
            />
            <button disabled={busy}>
              {busy ? 'Criando…' : 'Criar e gerar convite'}
            </button>
            {message && <output>{message}</output>}
            {link && (
              <label className="wide">
                Link de ativação
                <input
                  value={link}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

export function SupplierDetailTools({
  id,
  displayName,
  legalName,
  notes,
  exemptions,
}: {
  id: string;
  displayName: string;
  legalName: string;
  notes: string;
  exemptions: {
    type: 'monthly_fee' | 'commission';
    startsAt: string;
    endsAt: string | null;
    reason: string;
  }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function request(method: string, body: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch(
      `/api/admin/organizations/${id}/fee-exemptions`,
      {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Isenção atualizada com auditoria.'
        : (result.error ?? 'Falha ao atualizar.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  async function update(form: FormData) {
    setBusy(true);
    const response = await fetch(`/api/admin/organizations/${id}/details`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: form.get('displayName'),
        legalName: form.get('legalName'),
        administrativeNotes: form.get('notes'),
      }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Dados e observações atualizados.'
        : (body.error ?? 'Falha ao atualizar.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  async function exempt(form: FormData) {
    await request('POST', {
      type: form.get('type'),
      endsAt: form.get('endsAt') || undefined,
      reason: form.get('reason'),
    });
  }
  return (
    <div className="supplier-admin-grid">
      <form className="surface-card admin-detail-form" action={update}>
        <h2>Dados e observações administrativas</h2>
        <label>
          Nome fantasia
          <input name="displayName" defaultValue={displayName} required />
        </label>
        <label>
          Razão social
          <input name="legalName" defaultValue={legalName} required />
        </label>
        <label>
          Observações exclusivas do admin
          <textarea name="notes" defaultValue={notes} />
        </label>
        <button disabled={busy}>Salvar alterações</button>
      </form>
      <form className="surface-card admin-detail-form" action={exempt}>
        <h2>
          <ShieldCheck /> Isenção comercial
        </h2>
        <label>
          Tipo
          <select name="type">
            <option value="monthly_fee">Mensalidade</option>
            <option value="commission">Comissão</option>
          </select>
        </label>
        <label>
          Válida até
          <input name="endsAt" type="date" />
        </label>
        <label>
          Justificativa
          <textarea name="reason" minLength={5} required />
        </label>
        <button disabled={busy}>Conceder isenção</button>
        {exemptions.map((item) => (
          <article className="active-exemption" key={item.type}>
            <div>
              <strong>
                {item.type === 'monthly_fee' ? 'Mensalidade' : 'Comissão'}{' '}
                isenta
              </strong>
              <small>
                {item.endsAt
                  ? `até ${new Date(item.endsAt).toLocaleDateString('pt-BR')}`
                  : 'sem vencimento'}{' '}
                · {item.reason}
              </small>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt(
                  'Justificativa para revogar a isenção',
                );
                if (reason) void request('DELETE', { type: item.type, reason });
              }}
            >
              Revogar
            </button>
          </article>
        ))}
      </form>
      {message && <output className="operation-message">{message}</output>}
    </div>
  );
}

export function ResellerDetailTools({
  id,
  displayName,
  legalName,
  notes,
  phone,
  cpf,
}: {
  id: string;
  displayName: string;
  legalName: string;
  notes: string;
  phone: string;
  cpf: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function update(form: FormData) {
    setBusy(true);
    const response = await fetch(`/api/admin/organizations/${id}/details`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: form.get('displayName'),
        legalName: form.get('legalName'),
        administrativeNotes: form.get('notes'),
        phone: form.get('phone'),
        cpf: form.get('cpf'),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    setMessage(
      response.ok
        ? 'Cadastro do revendedor atualizado e auditado.'
        : (result.error ?? 'Falha ao atualizar.'),
    );
    if (response.ok) router.refresh();
  }
  return (
    <form
      className="surface-card admin-detail-form reseller-detail-form"
      action={update}
    >
      <h2>Manutenção do revendedor</h2>
      <div className="form-columns">
        <label>
          Nome
          <input name="displayName" defaultValue={displayName} required />
        </label>
        <label>
          Nome legal
          <input name="legalName" defaultValue={legalName} required />
        </label>
        <label>
          CPF
          <input name="cpf" defaultValue={cpf} />
        </label>
        <label>
          Telefone
          <input name="phone" defaultValue={phone} />
        </label>
      </div>
      <label>
        Observações exclusivas do admin
        <textarea name="notes" defaultValue={notes} />
      </label>
      <button disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar alterações'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
