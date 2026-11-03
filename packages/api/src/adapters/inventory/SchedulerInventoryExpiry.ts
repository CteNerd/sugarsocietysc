import { CreateScheduleCommand, GetScheduleCommand, SchedulerClient } from '@aws-sdk/client-scheduler';
import { IInventoryExpiryScheduler } from '../../ports/inventory/IInventoryExpiryScheduler';

export class SchedulerInventoryExpiry implements IInventoryExpiryScheduler {
  constructor(
    private readonly groupName: string,
    private readonly targetArn: string,
    private readonly roleArn: string,
    private readonly deadLetterQueueArn?: string,
    private readonly client = new SchedulerClient({ maxAttempts: 1 }),
  ) {}

  async schedule(orderId: string, expiresAt: Date): Promise<void> {
    const timestamp = new Date(Math.ceil(expiresAt.getTime() / 1000) * 1000).toISOString().slice(0, 19);
    const input = {
      Name: `order-${orderId}`,
      GroupName: this.groupName,
      ClientToken: orderId,
      ScheduleExpression: `at(${timestamp})`,
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' as const },
      ActionAfterCompletion: 'DELETE' as const,
      Target: {
        Arn: this.targetArn, RoleArn: this.roleArn,
        Input: JSON.stringify({ orderId }),
        DeadLetterConfig: this.deadLetterQueueArn ? { Arn: this.deadLetterQueueArn } : undefined,
        RetryPolicy: { MaximumRetryAttempts: 10, MaximumEventAgeInSeconds: 3600 },
      },
    };
    try { await this.client.send(new CreateScheduleCommand(input)); }
    catch (error) {
      if (!(error instanceof Error) || error.name !== 'ConflictException') throw error;
      const existing = await this.client.send(new GetScheduleCommand({ Name: input.Name, GroupName: this.groupName }));
      if (
        existing.ScheduleExpression !== input.ScheduleExpression
        || existing.ScheduleExpressionTimezone !== 'UTC'
        || existing.FlexibleTimeWindow?.Mode !== 'OFF'
        || existing.ActionAfterCompletion !== 'DELETE'
        || existing.Target?.Arn !== this.targetArn
        || existing.Target?.RoleArn !== this.roleArn
        || existing.Target?.Input !== input.Target.Input
        || existing.Target?.DeadLetterConfig?.Arn !== this.deadLetterQueueArn
        || existing.Target?.RetryPolicy?.MaximumRetryAttempts !== input.Target.RetryPolicy.MaximumRetryAttempts
        || existing.Target?.RetryPolicy?.MaximumEventAgeInSeconds !== input.Target.RetryPolicy.MaximumEventAgeInSeconds
        || existing.State !== 'ENABLED'
      ) throw new Error('Existing inventory schedule does not match the durable expiry task');
    }
  }
}
