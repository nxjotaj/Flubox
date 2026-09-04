'use client';

import { Bell, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Preferences = {
  emailOperations: boolean;
  emailOrders: boolean;
  emailMessages: boolean;
  emailMarketing: boolean;
  browserNotifications: boolean;
};

export function NotificationPreferencesForm({
  initial,
}: {
  initial: Preferences;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(form: FormData) {
    setBusy(true);
    const enabled = (key: string) => form.get(key) === 'on';
    const response = await fetch('/api/account/notifications', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        emailOperations: enabled('emailOperations'),
        emailOrders: enabled('emailOrders'),
        emailMessages: enabled('emailMessages'),
        emailMarketing: enabled('emailMarketing'),
        browserNotifications: enabled('browserNotifications'),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? 'Preferências atualizadas.'
        : (result.error ?? 'Não foi possível salvar.'),
    );
    setBusy(false);
  }
  const options = [
    [
      'emailOperations',
      'Operação da conta',
      'Alertas importantes, segurança e alterações cadastrais.',
    ],
    [
      'emailOrders',
      'Pedidos e pagamentos',
      'Novos pedidos, PIX, separação e entrega.',
    ],
    [
      'emailMessages',
      'Mensagens e atendimento',
      'Perguntas, chamados e atualizações de suporte.',
    ],
    [
      'browserNotifications',
      'Notificações no painel',
      'Avisos visíveis enquanto você usa o Flubox.',
    ],
    [
      'emailMarketing',
      'Novidades do Flubox',
      'Conteúdo promocional e lançamentos; opcional.',
    ],
  ] as const;
  return (
    <form
      className="surface-card preferences-form flex w-full max-w-[980px] flex-col gap-0 p-6"
      action={save}
    >
      <header className="mb-3 flex items-start gap-3">
        <Bell />
        <div>
          <h2>Notificações</h2>
          <p>Escolha como quer receber cada tipo de aviso.</p>
        </div>
      </header>
      {options.map(([key, title, description]) => (
        <label
          className="preference-row flex min-h-16 w-full items-center justify-between gap-6 border-t py-4"
          key={key}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <input
            className="size-[18px] min-h-[18px] min-w-[18px] shrink-0 p-0"
            type="checkbox"
            name={key}
            aria-label={title}
            defaultChecked={initial[key]}
          />
        </label>
      ))}
      <Button className="mt-4 w-fit" size="lg" disabled={busy}>
        <Save /> {busy ? 'Salvando…' : 'Salvar notificações'}
      </Button>
      {message && <output>{message}</output>}
    </form>
  );
}
