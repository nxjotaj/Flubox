'use client';
import { useState } from 'react';
export function LogisticsActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [message, setMessage] = useState('');
  async function act(action: string) {
    const carrier =
      action === 'ship' ? window.prompt('Transportadora') : undefined;
    const trackingCode =
      action === 'ship' ? window.prompt('Código de rastreio') : undefined;
    if (action === 'ship' && (!carrier || !trackingCode)) return;
    const response = await fetch(`/api/orders/${orderId}/logistics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, carrier, trackingCode }),
    });
    const data = (await response.json()) as { error?: string };
    if (response.ok) location.reload();
    else setMessage(data.error ?? 'Falha na atualização.');
  }
  return (
    <div className="logistics-actions">
      {status === 'ready_for_supplier' && (
        <button onClick={() => void act('accept')}>Iniciar preparação</button>
      )}
      {status === 'preparing' && (
        <button onClick={() => void act('ready')}>
          Marcar pronto para envio
        </button>
      )}
      {status === 'ready_to_ship' && (
        <button onClick={() => void act('ship')}>Informar envio</button>
      )}
      {(status === 'shipped' || status === 'in_transit') && (
        <button onClick={() => void act('deliver')}>Confirmar entrega</button>
      )}
      {message && <output>{message}</output>}
    </div>
  );
}
