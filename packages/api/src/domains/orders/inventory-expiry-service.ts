import { IInventoryExpiryScheduler } from '../../ports/inventory/IInventoryExpiryScheduler';
import { OrdersRepository } from './orders-repository';

export class InventoryExpiryService {
  constructor(private readonly repository: OrdersRepository, private readonly scheduler: IInventoryExpiryScheduler) {}

  async dispatch(orderId?: string, signal?: AbortSignal): Promise<void> {
    const tasks = await this.repository.findPendingInventoryExpiryTasks(orderId);
    const errors: unknown[] = [];
    for (const task of tasks) {
      try {
        if (task.expiresAt.getTime() <= Date.now()) {
          await this.repository.expireOrderInventoryHold(task.orderId);
        } else if (!task.dispatchedAt) {
          await this.scheduler.schedule(task.orderId, task.expiresAt, signal);
          await this.repository.markInventoryExpiryDispatched(task.orderId);
        }
      } catch (error) {
        console.error('Inventory expiry dispatch failed', {
          orderId: task.orderId, errorType: error instanceof Error ? error.name : 'Error',
        });
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Inventory expiry tasks require reconciliation retry');
  }
}
