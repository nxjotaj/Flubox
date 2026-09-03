'use client';

import { SyntheticEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginForm() {
  const search = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
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
            options: { data: { full_name: fullName } },
          });
    if (result.error) {
      setMessage(
        result.error.message === 'Invalid login credentials'
          ? 'E-mail ou senha inválidos.'
          : result.error.message,
      );
      setPending(false);
      return;
    }
    if (mode === 'register' && !result.data.session) {
      setMessage(
        'Confira seu e-mail para confirmar o cadastro antes de entrar.',
      );
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

  return (
    <div className="login-box">
      <div className="auth-tabs" role="tablist" aria-label="Tipo de acesso">
        <button
          className={mode === 'login' ? 'active' : ''}
          onClick={() => setMode('login')}
          type="button"
        >
          Entrar
        </button>
        <button
          className={mode === 'register' ? 'active' : ''}
          onClick={() => setMode('register')}
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
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
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
