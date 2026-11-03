export interface IInventoryExpiryScheduler {
  schedule(orderId: string, expiresAt: Date, signal?: AbortSignal): Promise<void>;
}
