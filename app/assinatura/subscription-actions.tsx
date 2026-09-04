'use client';

import { CreditCard, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PaymentMethodForm } from './payment-method-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SubscriptionActions({
  active,
  cancellationScheduled,
}: {
  active: boolean;
  cancellationScheduled: boolean;
}) {
  const router = useRouter();
  const [editingCard, setEditingCard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function command(action: 'cancel' | 'reactivate') {
    if (
      action === 'cancel' &&
      !confirm(
        'Cancelar a renovação da assinatura ao final do período já pago?',
      )
    )
      return;
    setBusy(true);
    const response = await fetch('/api/billing/subscription', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const result = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? action === 'cancel'
          ? 'Cancelamento agendado.'
          : 'Renovação reativada.'
        : (result.error ?? 'Não foi possível concluir.'),
    );
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Ações da assinatura</CardTitle>
        <CardDescription>
          Gerencie cobrança, renovação e cancelamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap gap-3">
          {active && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setEditingCard((value) => !value)}
            >
              <CreditCard /> Alterar cartão de cobrança
            </Button>
          )}
          {active && !cancellationScheduled && (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={busy}
              onClick={() => void command('cancel')}
            >
              <XCircle /> Cancelar renovação
            </Button>
          )}
          {active && cancellationScheduled && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => void command('reactivate')}
            >
              <RotateCcw /> Manter assinatura ativa
            </Button>
          )}
        </div>
        {editingCard && (
          <div className="rounded-xl border bg-muted/40 p-5">
            <h3 className="mb-4 font-semibold">Novo cartão</h3>
            <PaymentMethodForm
              mode="replace"
              onSuccess={() => setEditingCard(false)}
            />
          </div>
        )}
        {message && (
          <output className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {message}
          </output>
        )}
      </CardContent>
    </Card>
  );
}
