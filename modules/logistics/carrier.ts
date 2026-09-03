export type TrackingUpdate = {
  externalId: string;
  status: string;
  description: string;
  location?: string;
  occurredAt: string;
};
export interface CarrierAdapter {
  readonly name: string;
  validateTrackingCode(code: string): Promise<boolean>;
  getTracking(code: string): Promise<TrackingUpdate[]>;
}
export class CarrierUnavailableError extends Error {
  constructor() {
    super('CARRIER_ADAPTER_UNAVAILABLE');
  }
}
export function getCarrierAdapter(_carrier: string): CarrierAdapter {
  throw new CarrierUnavailableError();
}
