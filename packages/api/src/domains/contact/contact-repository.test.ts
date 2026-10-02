import { describe, expect, it, vi } from 'vitest';
import { ContactRepository } from './contact-repository';

describe('ContactRepository', () => {
  it('stores submissions under a unique request key and retrieves an existing row on retry', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'submission-1',
          request_id: 'c95b7de2-1a51-4f51-b781-ff267f17845d',
          first_name: 'Jamie',
          last_name: 'Baker',
          email: 'jamie@example.com',
          phone: null,
          subject: 'Custom cookies',
          message: null,
          email_status: 'pending',
        }],
      });
    const repository = new ContactRepository({ query } as never);

    const result = await repository.createOrFind({
      requestId: 'c95b7de2-1a51-4f51-b781-ff267f17845d',
      firstName: 'Jamie',
      lastName: 'Baker',
      email: 'jamie@example.com',
      phone: '',
      subject: 'Custom cookies',
      message: '',
    });

    expect(result).toMatchObject({ id: 'submission-1', emailStatus: 'pending' });
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (request_id) DO NOTHING');
    expect(query.mock.calls[1][1]).toEqual(['c95b7de2-1a51-4f51-b781-ff267f17845d']);
  });

  it('rejects a request ID reused with different content', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'submission-1',
          request_id: 'c95b7de2-1a51-4f51-b781-ff267f17845d',
          first_name: 'Other',
          last_name: 'Baker',
          email: 'jamie@example.com',
          phone: null,
          subject: 'Custom cookies',
          message: null,
          email_status: 'pending',
        }],
      });
    const repository = new ContactRepository({ query } as never);

    await expect(repository.createOrFind({
      requestId: 'c95b7de2-1a51-4f51-b781-ff267f17845d',
      firstName: 'Jamie',
      lastName: 'Baker',
      email: 'jamie@example.com',
      subject: 'Custom cookies',
    })).rejects.toThrow('Contact request ID was reused');
  });

  it('claims a notification only when it is pending or its prior attempt lease expired', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new ContactRepository({ query } as never);

    await expect(repository.claimForDelivery('submission-1')).resolves.toBeUndefined();
    expect(query.mock.calls[0][0]).toContain("email_status = 'pending'");
    expect(query.mock.calls[0][0]).toContain("last_attempt_at <= now() - interval '5 minutes'");
  });

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
