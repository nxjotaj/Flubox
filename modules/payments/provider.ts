export type PixCharge = {
  externalId: string;
  copyPaste: string;
  qrCode: Uint8Array | null;
  amountCents: number;
  expiresAt: string;
};
export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'expired'
  | 'cancelled'
  | 'refunded';
export interface PaymentProvider {
  readonly name: string;
  createPixCharge(input: {
    orderId: string;
    amountCents: number;
    expiresAt: string;
    idempotencyKey: string;
  }): Promise<PixCharge>;
  getCharge(
    externalId: string,
  ): Promise<{ status: PaymentStatus; paidAt?: string }>;
  refund(input: {
    externalId: string;
    amountCents: number;
    idempotencyKey: string;
  }): Promise<{ externalId: string; status: PaymentStatus }>;
  verifyWebhook(
    request: Request,
    rawBody: string,
  ): Promise<{
    eventId: string;
    externalId: string;
    status: PaymentStatus;
    occurredAt: string;
  }>;
}

export class PaymentProviderUnavailableError extends Error {
  constructor() {
    super('PAYMENT_PROVIDER_UNAVAILABLE');
  }
}

class DevelopmentPaymentProvider implements PaymentProvider {
  readonly name = 'development';

  async createPixCharge(input: {
    orderId: string;
    amountCents: number;
    expiresAt: string;
    idempotencyKey: string;
  }): Promise<PixCharge> {
    const externalId = `dev_pix_${input.orderId}`;
    return {
      externalId,
      copyPaste: `00020126580014BR.GOV.BCB.PIX0136${externalId}520400005303986540${(input.amountCents / 100).toFixed(2)}5802BR5906FLUBOX6009SAOPAULO62070503***6304DEV0`,
      qrCode: null,
      amountCents: input.amountCents,
      expiresAt: input.expiresAt,
    };
  }

  async getCharge(externalId: string) {
    return { status: 'pending' as const, externalId };
  }

  async refund(input: {
    externalId: string;
    amountCents: number;
    idempotencyKey: string;
  }) {
    return {
      externalId: `dev_refund_${input.idempotencyKey}`,
      status: 'refunded' as const,
    };
  }

  async verifyWebhook(_request: Request, rawBody: string) {
    const body = JSON.parse(rawBody) as {
      eventId: string;
      externalId: string;
      status: PaymentStatus;
      occurredAt?: string;
    };
    return {
      eventId: body.eventId,
      externalId: body.externalId,
      status: body.status,
      occurredAt: body.occurredAt ?? new Date().toISOString(),
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (
    process.env.NODE_ENV === 'development' ||
    (process.env.PAYMENT_PROVIDER === 'development' &&
      process.env.NODE_ENV !== 'production')
  )
    return new DevelopmentPaymentProvider();
  throw new PaymentProviderUnavailableError();
}
