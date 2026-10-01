import { describe, expect, it, vi } from 'vitest';
import { GuestPiiRetentionRepository } from './guest-pii-retention-repository';

describe('GuestPiiRetentionRepository', () => {
  it('clears contact data only for completed or cancelled guest orders beyond retention', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 3 });
    const repository = new GuestPiiRetentionRepository({ query } as never);

    await expect(repository.purgeExpiredGuestContact(60)).resolves.toBe(3);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("o.status IN ('complete', 'cancelled')"), [60]);
    expect(query.mock.calls[0][0]).toContain('h.changed_at <= now() - ($1::int * interval');
    expect(query.mock.calls[0][0]).toContain('o.user_id IS NULL');
  });

  it('rejects invalid retention windows before issuing SQL', async () => {
    const query = vi.fn();
    const repository = new GuestPiiRetentionRepository({ query } as never);

    await expect(repository.purgeExpiredGuestContact(0)).rejects.toThrow('positive integer');
    expect(query).not.toHaveBeenCalled();
  });
});
