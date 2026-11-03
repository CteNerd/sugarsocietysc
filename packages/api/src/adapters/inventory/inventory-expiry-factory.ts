import { AppConfig } from '../../config/env';
import { IInventoryExpiryScheduler } from '../../ports/inventory/IInventoryExpiryScheduler';
import { SchedulerInventoryExpiry } from './SchedulerInventoryExpiry';

export function createInventoryExpiryScheduler(config: AppConfig): IInventoryExpiryScheduler | undefined {
  if (!config.inventoryExpiryScheduleGroup) {
    if (config.inventoryExpiryTargetArn || config.inventoryExpiryRoleArn || config.inventoryExpiryDeadLetterQueueArn) {
      throw new Error('Inventory expiry scheduling requires a schedule group');
    }
    return undefined;
  }
  if (!config.inventoryExpiryTargetArn || !config.inventoryExpiryRoleArn || !config.inventoryExpiryDeadLetterQueueArn) {
    throw new Error('Inventory expiry scheduling requires target, role and dead-letter queue ARNs');
  }
  return new SchedulerInventoryExpiry(
    config.inventoryExpiryScheduleGroup, config.inventoryExpiryTargetArn, config.inventoryExpiryRoleArn,
    config.inventoryExpiryDeadLetterQueueArn,
  );
}
