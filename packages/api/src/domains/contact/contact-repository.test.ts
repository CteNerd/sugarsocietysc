import { describe, expect, it, vi } from 'vitest';
import { ContactRepository } from './contact-repository';

describe('ContactRepository', () => {
  it('deletes contact submissions older than the configured retention period', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 2 });
    const repository = new ContactRepository({ query } as never);

    await expect(repository.purgeExpired(365)).resolves.toBe(2);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('submitted_at <= now() - ($1::int * interval'),
      [365],
    );
  });

  it('rejects an invalid retention period before issuing SQL', async () => {
    const query = vi.fn();
    const repository = new ContactRepository({ query } as never);

    await expect(repository.purgeExpired(0)).rejects.toThrow('positive integer');
    expect(query).not.toHaveBeenCalled();
  });
});
