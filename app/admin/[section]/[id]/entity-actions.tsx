'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function EntityActions({
  section,
  id,
  status,
}: {
  section: string;
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage('');
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    setMessage(
      response.ok
        ? 'Alteração registrada com sucesso.'
        : (result.error ?? 'Não foi possível concluir.'),
    );
    if (response.ok) router.refresh();
  }

  if (['fornecedores', 'revendedores'].includes(section)) {
    const next = status === 'active' ? 'suspended' : 'active';
    const activating = next === 'active';
    return (
      <div className="detail-actions">
        <button
          disabled={busy}
          className={next === 'suspended' ? 'danger' : 'dark'}
          onClick={() =>
            void send(`/api/admin/organizations/${id}/status`, {
              status: next,
              reason:
                next === 'suspended'
                  ? 'Suspensão administrativa'
                  : status === 'onboarding'
                    ? 'Cadastro empresarial aprovado após análise'
                    : 'Reativação administrativa',
            })
          }
        >
          {next === 'suspended'
            ? 'Suspender organização'
            : status === 'onboarding'
              ? 'Aprovar fornecedor'
              : 'Reativar organização'}
        </button>
        {activating && status === 'onboarding' && (
          <small>
            A aprovação libera a operação quando a assinatura estiver ativa.
          </small>
        )}
        {message && <output>{message}</output>}
        {status !== 'archived' && (
          <button
            disabled={busy}
            className="danger"
            onClick={() => {
              const reason = window.prompt(
                'Justificativa para arquivar esta organização',
              );
              if (
                reason &&
                window.confirm(
                  'Arquivar a organização e ocultá-la da operação?',
                )
              )
                void send(`/api/admin/organizations/${id}/status`, {
                  status: 'archived',
                  reason,
                });
            }}
          >
            Arquivar organização
          </button>
        )}
      </div>
    );
  }
  if (section === 'usuarios') {
    const next = status === 'active' ? 'revoked' : 'active';
    return (
      <div className="detail-actions">
        <button
          disabled={busy}
          className={next === 'revoked' ? 'danger' : 'dark'}
          onClick={() =>
            void send(`/api/admin/members/${id}/status`, {
              status: next,
              reason: 'Alteração administrativa de acesso',
            })
          }
        >
          {next === 'revoked' ? 'Revogar acesso' : 'Restaurar acesso'}
        </button>
        {message && <output>{message}</output>}
      </div>
    );
  }
  if (section === 'disputas' && status !== 'resolved') {
    return (
      <div className="detail-actions">
        <button
          disabled={busy}
          className="dark"
          onClick={() =>
            void send(`/api/admin/cases/${id}/resolve`, {
              resolution: 'closed_by_mediation',
              reason: 'Encerramento administrativo após análise',
            })
          }
        >
          Resolver disputa
        </button>
        <button
          disabled={busy}
          className="danger"
          onClick={() => {
            const amount = window.prompt(
              'Valor do reembolso em reais (ex.: 149,90)',
            );
            if (!amount) return;
            const reason = window.prompt(
              'Justificativa detalhada do reembolso',
            );
            const amountCents = Math.round(
              Number(amount.replace(',', '.')) * 100,
            );
            if (
              reason &&
              Number.isInteger(amountCents) &&
              amountCents > 0 &&
              window.confirm(
                `Confirmar reembolso de R$ ${amount.replace('.', ',')}?`,
              )
            )
              void send(`/api/admin/cases/${id}/refund`, {
                amountCents,
                reason,
              });
          }}
        >
          Determinar reembolso
        </button>
        {message && <output>{message}</output>}
      </div>
    );
  }
  return null;
}
