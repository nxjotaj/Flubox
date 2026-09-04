'use client';

import { Bell, Save } from 'lucide-react';
import { useState } from 'react';

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
    <form className="surface-card preferences-form" action={save}>
      <header>
        <Bell />
        <div>
          <h2>Notificações</h2>
          <p>Escolha como quer receber cada tipo de aviso.</p>
        </div>
      </header>
      {options.map(([key, title, description]) => (
        <label className="preference-row" key={key}>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <input
            type="checkbox"
            name={key}
            aria-label={title}
            defaultChecked={initial[key]}
          />
        </label>
      ))}
      <button disabled={busy}>
        <Save /> {busy ? 'Salvando…' : 'Salvar notificações'}
      </button>
      {message && <output>{message}</output>}
    </form>
  );
}
