'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function PaymentMethodForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage('');
    const value = (key: string) => {
      const entry = formData.get(key);
      return typeof entry === 'string' ? entry : '';
    };
    const response = await fetch('/api/billing/payment-method', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        holderName: value('holderName'),
        number: value('number'),
        expiryMonth: Number(value('expiryMonth')),
        expiryYear: Number(value('expiryYear')),
        cvv: value('cvv'),
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      brand?: string;
      lastFour?: string;
    };
    setMessage(
      response.ok
        ? `Assinatura ativa com ${result.brand} final ${result.lastFour}.`
        : (result.error ?? 'Falha na ativação.'),
    );
    setBusy(false);
    if (response.ok) {
      router.refresh();
      setTimeout(() => router.push('/dashboard'), 700);
    }
  }
  return (
    <form className="billing-form" action={submit}>
      <label>
        Nome impresso no cartão
        <input name="holderName" autoComplete="cc-name" required />
      </label>
      <label>
        Número do cartão de teste
        <input
          name="number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          required
        />
      </label>
      <div>
        <label>
          Mês
          <input
            name="expiryMonth"
            type="number"
            min="1"
            max="12"
            defaultValue="12"
            required
          />
        </label>
        <label>
          Ano
          <input
            name="expiryYear"
            type="number"
            min={new Date().getFullYear()}
            defaultValue={new Date().getFullYear() + 2}
            required
          />
        </label>
        <label>
          CVV
          <input
            name="cvv"
            inputMode="numeric"
            autoComplete="cc-csc"
            minLength={3}
            maxLength={4}
            required
          />
        </label>
      </div>
      <button disabled={busy}>
        {busy ? 'Tokenizando…' : 'Ativar assinatura mensal'}
      </button>
      <small>
        Ambiente de desenvolvimento: nenhum número ou CVV é persistido. Em
        produção, o formulário seguro será fornecido pelo PSP.
      </small>
      {message && <output>{message}</output>}
    </form>
  );
}
