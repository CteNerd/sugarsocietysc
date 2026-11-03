import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateScheduleCommand, SchedulerClient } from '@aws-sdk/client-scheduler';
import { SchedulerInventoryExpiry } from './SchedulerInventoryExpiry';

const orderId = '09004180-70ac-479f-8b76-e2357c932db7';
const expiresAt = new Date('2026-11-02T12:30:00.123Z');
afterEach(() => vi.restoreAllMocks());

describe('Scheduler inventory expiration', () => {
  it('creates a deterministic UTC schedule that never rounds the hold down', async () => {
    const client = new SchedulerClient({ maxAttempts: 1 });
    const send = vi.spyOn(client, 'send').mockImplementation(async () => ({ $metadata: {} }));
    await new SchedulerInventoryExpiry('group', 'target', 'role', 'queue', client).schedule(orderId, expiresAt);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(CreateScheduleCommand);
    if (!(command instanceof CreateScheduleCommand)) throw new Error('Unexpected scheduler command');
    expect(command.input).toMatchObject({
      Name: `order-${orderId}`, ClientToken: orderId, GroupName: 'group',
      ScheduleExpression: 'at(2026-11-02T12:30:01)', ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' }, ActionAfterCompletion: 'DELETE',
      Target: { Arn: 'target', RoleArn: 'role', Input: JSON.stringify({ orderId }),
        DeadLetterConfig: { Arn: 'queue' } },
    });
  });

  it.each([true, false])('accepts conflicts only when the existing schedule matches: %s', async (matches) => {
    const client = new SchedulerClient({ maxAttempts: 1 });
    vi.spyOn(client, 'send').mockImplementation(async (command) => {
      if (command instanceof CreateScheduleCommand) {
        throw Object.assign(new Error('Already exists'), { name: 'ConflictException' });
      }
      return {
        $metadata: {}, ScheduleExpression: 'at(2026-11-02T12:30:01)',
        ScheduleExpressionTimezone: matches ? 'UTC' : 'America/New_York',
        State: 'ENABLED', FlexibleTimeWindow: { Mode: 'OFF' }, ActionAfterCompletion: 'DELETE',
        Target: { Arn: 'target', RoleArn: 'role', Input: JSON.stringify({ orderId }),
          RetryPolicy: { MaximumRetryAttempts: 10, MaximumEventAgeInSeconds: 3600 } },
      };
    });
    const scheduled = new SchedulerInventoryExpiry('group', 'target', 'role', undefined, client).schedule(orderId, expiresAt);
    if (matches) await expect(scheduled).resolves.toBeUndefined();
    else await expect(scheduled).rejects.toThrow('does not match');
  });

  it('does not turn an ambiguous scheduling failure into success', async () => {
    const client = new SchedulerClient({ maxAttempts: 1 });
    const failure = new Error('Response lost');
    const send = vi.spyOn(client, 'send').mockImplementation(async () => { throw failure; });
    await expect(new SchedulerInventoryExpiry('group', 'target', 'role', undefined, client).schedule(orderId, expiresAt))
      .rejects.toBe(failure);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
