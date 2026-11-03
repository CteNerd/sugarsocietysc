export interface IInventoryExpiryScheduler {
  schedule(orderId: string, expiresAt: Date): Promise<void>;
}
