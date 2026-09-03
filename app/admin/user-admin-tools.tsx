'use client';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Org = { id: string; name: string; type: string };
export function CreateUserInvite({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState(
    organizations[0]?.id ?? '',
  );
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const type = organizations.find((item) => item.id === organizationId)?.type;
  const roleOptions =
    type === 'supplier'
      ? [
          ['supplier_owner', 'Proprietário'],
          ['supplier_member', 'Colaborador'],
          ['supplier_operator_1', 'Operador 1'],
          ['supplier_operator_2', 'Operador 2'],
        ]
      : type === 'reseller'
        ? [['reseller_owner', 'Proprietário revendedor']]
        : [['platform_admin', 'Administrador da plataforma']];
  async function submit(form: FormData) {
    setBusy(true);
    const response = await fetch('/api/admin/users/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        email: form.get('email'),
        role: form.get('role'),
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      activationPath?: string;
    };
    setBusy(false);
    setMessage(
      response.ok
        ? 'Convite criado com auditoria.'
        : (result.error ?? 'Falha ao criar convite.'),
    );
    if (response.ok && result.activationPath) {
      setLink(`${location.origin}${result.activationPath}`);
      router.refresh();
    }
  }
  return (
    <div className="admin-create-wrap">
      <button className="primary-action" onClick={() => setOpen(!open)}>
        <Plus /> Criar usuário
      </button>
      {open && (
        <form className="admin-action-panel compact" action={submit}>
          <h2>Novo acesso</h2>
          <label>
            Organização
            <select
              name="organizationId"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {organizations.map((org) => (
                <option value={org.id} key={org.id}>
                  {org.name} · {org.type}
                </option>
              ))}
            </select>
          </label>
          <label>
            E-mail
            <input name="email" type="email" required />
          </label>
          <label>
            Papel
            <select name="role">
              {roleOptions.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy}>{busy ? 'Criando…' : 'Gerar convite'}</button>
          {message && <output>{message}</output>}
          {link && (
            <label>
              Link de ativação
              <input
                value={link}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          )}
        </form>
      )}
    </div>
  );
}
