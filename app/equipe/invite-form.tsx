'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('supplier_member');
  const [activationLink, setActivationLink] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const response = await fetch('/api/team/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const result = (await response.json()) as {
      error?: string;
      message?: string;
      activationPath?: string;
    };
    setMessage(result.error ?? result.message ?? '');
    if (response.ok) {
      setActivationLink(
        result.activationPath
          ? `${window.location.origin}${result.activationPath}`
          : '',
      );
      setEmail('');
      router.refresh();
    }
    setPending(false);
  }
  return (
    <form className="invite-form" onSubmit={submit}>
      <Input
        type="email"
        placeholder="colaborador@empresa.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <select
        value={role}
        onChange={(event) => setRole(event.target.value)}
        aria-label="Função do convite"
      >
        <option value="supplier_member">Colaborador configurável</option>
        <option value="supplier_operator_1">Operador de expedição 1</option>
        <option value="supplier_operator_2">Operador de expedição 2</option>
      </select>
      <Button disabled={pending}>
        {pending ? 'Registrando…' : 'Registrar convite'}
      </Button>
      {message && <small>{message}</small>}
      {activationLink && (
        <label className="invite-link" htmlFor="activation-link">
          <span>Link de ativação</span>
          <Input
            id="activation-link"
            value={activationLink}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </form>
  );
}
