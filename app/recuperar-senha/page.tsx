'use client';

import { type SyntheticEvent, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RecoverPasswordPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const value = form.get('email');
    const email = typeof value === 'string' ? value : '';
    const { error } =
      await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/entrar`,
      });
    setMessage(
      error
        ? error.message
        : 'Enviamos as instruções de recuperação para o e-mail informado.',
    );
    setBusy(false);
  }

  return (
    <main className="standalone-form">
      <a href="/">
        <BrandLogo />
      </a>
      <section>
        <span className="page-kicker">
          <MailCheck /> Recuperação de acesso
        </span>
        <h1>Redefina sua senha</h1>
        <p>
          Informe o e-mail utilizado no Flubox. Você receberá um link seguro
          para criar uma nova senha.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="recovery-email">
            E-mail
            <Input
              id="recovery-email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </label>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar link de recuperação'}
          </Button>
          {message && <output>{message}</output>}
        </form>
        <a href="/entrar">Voltar para o login</a>
      </section>
    </main>
  );
}
