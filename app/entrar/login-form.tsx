'use client';

import { SyntheticEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, LoaderCircle, MailPlus } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginForm() {
  const search = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    search.get('confirmation') === 'invalid'
      ? 'Este link de confirmação é inválido ou expirou. Solicite um novo link.'
      : '',
  );
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [emailValue, setEmailValue] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setPendingEmail('');
    const form = new FormData(event.currentTarget);
    const field = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value : '';
    };
    const email = field('email').trim().toLowerCase();
    const password = field('password');
    const fullName = field('fullName').trim();
    const supabase = createSupabaseBrowserClient();
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: `${window.location.origin}/auth/continue`,
            },
          });
    if (result.error) {
      const confirmationPending = result.error.message
        .toLowerCase()
        .includes('email not confirmed');
      setMessage(
        result.error.message === 'Invalid login credentials'
          ? 'E-mail ou senha inválidos.'
          : confirmationPending
            ? 'Seu e-mail ainda não foi confirmado.'
            : result.error.message,
      );
      setMessageKind('error');
      if (confirmationPending) setPendingEmail(email);
      setPending(false);
      return;
    }
    if (mode === 'register' && !result.data.session) {
      setMessage(
        'Confira seu e-mail para confirmar o cadastro antes de entrar.',
      );
      setMessageKind('success');
      setPendingEmail(email);
      setPending(false);
      return;
    }
    const destination = search.get('returnTo');
    const safeDestination =
      destination?.startsWith('/') && !destination.startsWith('//')
        ? destination
        : mode === 'register'
          ? '/cadastro'
          : '/entrar';
    window.location.assign(safeDestination);
  }

  async function resendConfirmation() {
    const email = (pendingEmail || emailValue).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setMessage('Informe o e-mail da conta para reenviar a confirmação.');
      setMessageKind('error');
      return;
    }
    setResending(true);
    const response = await fetch('/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Novo link enviado. Confira também a caixa de spam.'
        : (result.error ?? 'Não foi possível reenviar o link.'),
    );
    setMessageKind(response.ok ? 'success' : 'error');
    setResending(false);
  }

  return (
    <div className="login-box">
      <div className="auth-tabs" role="tablist" aria-label="Tipo de acesso">
        <button
          className={mode === 'login' ? 'active' : ''}
          onClick={() => {
            setMode('login');
            setMessage('');
            setPendingEmail('');
          }}
          type="button"
        >
          Entrar
        </button>
        <button
          className={mode === 'register' ? 'active' : ''}
          onClick={() => {
            setMode('register');
            setMessage('');
            setPendingEmail('');
          }}
          type="button"
        >
          Criar conta
        </button>
      </div>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <label htmlFor="full-name">
            Nome completo
            <Input
              id="full-name"
              name="fullName"
              autoComplete="name"
              required
              minLength={3}
            />
          </label>
        )}
        <label htmlFor="login-email">
          E-mail
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={emailValue}
            onChange={(event) => setEmailValue(event.target.value)}
            required
          />
        </label>
        <label htmlFor="login-password">
          Senha
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            required
            minLength={8}
          />
        </label>
        {message && (
          <Alert variant={messageKind === 'error' ? 'destructive' : 'default'}>
            {messageKind === 'success' && <CheckCircle2 />}
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {(pendingEmail || mode === 'login') && (
          <Button
            type="button"
            variant="outline"
            disabled={resending}
            onClick={() => void resendConfirmation()}
            className="resend-confirmation"
          >
            {resending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <MailPlus />
            )}
            {resending ? 'Reenviando…' : 'Reenviar link de confirmação'}
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="auth-primary"
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" /> Aguarde…
            </>
          ) : (
            <>
              {mode === 'login' ? 'Entrar no sistema' : 'Criar minha conta'}{' '}
              <ArrowRight />
            </>
          )}
        </Button>
      </form>
      {mode === 'login' && (
        <a className="forgot-link" href="/recuperar-senha">
          Esqueci minha senha
        </a>
      )}
    </div>
  );
}
