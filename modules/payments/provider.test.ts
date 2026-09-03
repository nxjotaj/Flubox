import { describe, expect, it } from 'vitest';
import {
  getPaymentProvider,
  PaymentProviderUnavailableError,
} from './provider';
describe('provedor de pagamento', () => {
  it('falha fechado quando nenhum PSP está configurado', () => {
    expect(() => getPaymentProvider()).toThrow(PaymentProviderUnavailableError);
  });
});
