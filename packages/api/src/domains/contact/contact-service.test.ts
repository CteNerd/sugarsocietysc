import { describe, expect, it, vi } from 'vitest';
import { ContactSubmissionRequest } from '@sugarsocietysc/shared';
import { IEmailProvider } from '../../ports/notification/IEmailProvider';
import { IHumanVerificationProvider } from '../../ports/contact/IHumanVerificationProvider';
import { IContactQueue } from '../../ports/contact/IContactQueue';
import { ContactRepository, StoredContactSubmission } from './contact-repository';
import { ContactDeliveryService, ContactSubmissionError, ContactService } from './contact-service';

const request: ContactSubmissionRequest = {
  requestId: 'c95b7de2-1a51-4f51-b781-ff267f17845d',
  firstName: 'Jamie',
  lastName: 'Baker',
  email: 'jamie@example.com',
  phone: '',
  subject: 'Custom cookies',
  message: '<script>alert("hello")</script>',
  recaptchaToken: 'valid-token',
};

const storedSubmission: StoredContactSubmission = {
  id: 'c95b7de2-1a51-4f51-b781-ff267f17845d',
  requestId: request.requestId,
  firstName: request.firstName,
  lastName: request.lastName,
  email: request.email,
  phone: request.phone,
  subject: request.subject,
  message: request.message,
  emailStatus: 'pending',
};

describe('ContactService', () => {
  it('stores a verified message once and queues notification delivery', async () => {
    const createOrFind = vi.fn().mockResolvedValue(storedSubmission);
    const enqueue = vi.fn();
    const verify = vi.fn().mockResolvedValue(true);
    const service = new ContactService(
      { createOrFind } as unknown as ContactRepository,
      { verify } as unknown as IHumanVerificationProvider,
      { enqueue } as unknown as IContactQueue,
    );

    await service.submit(request);

    expect(verify).toHaveBeenCalledWith('valid-token');
    expect(createOrFind).toHaveBeenCalledWith({
      requestId: request.requestId,
      firstName: 'Jamie',
      lastName: 'Baker',
      email: 'jamie@example.com',
      phone: '',
      subject: 'Custom cookies',
      message: '<script>alert("hello")</script>',
    });
    expect(enqueue).toHaveBeenCalledWith(storedSubmission.id);
  });

  it('does not queue a notification when the request has already been delivered', async () => {
    const enqueue = vi.fn();
    const service = new ContactService(
      {
        createOrFind: vi.fn().mockResolvedValue({ ...storedSubmission, emailStatus: 'sent' }),
      } as unknown as ContactRepository,
      { verify: vi.fn().mockResolvedValue(true) } as unknown as IHumanVerificationProvider,
      { enqueue } as unknown as IContactQueue,
    );

    await service.submit(request);

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('rejects a reused request ID with different form data', async () => {
    const service = new ContactService(
      {
        createOrFind: vi.fn().mockRejectedValue(
          new Error('Contact request ID was reused with different form data'),
        ),
      } as unknown as ContactRepository,
      { verify: vi.fn().mockResolvedValue(true) } as unknown as IHumanVerificationProvider,
      { enqueue: vi.fn() } as unknown as IContactQueue,
    );

    await expect(service.submit(request)).rejects.toMatchObject({
      message: 'Contact request ID was reused with different form data',
      statusCode: 409,
    });
  });

  it('rejects an unverified token before storing or queueing the message', async () => {
    const createOrFind = vi.fn();
    const enqueue = vi.fn();
    const service = new ContactService(
      { createOrFind } as unknown as ContactRepository,
      { verify: vi.fn().mockResolvedValue(false) } as unknown as IHumanVerificationProvider,
      { enqueue } as unknown as IContactQueue,
    );

    await expect(service.submit(request)).rejects.toThrow(ContactSubmissionError);
    expect(createOrFind).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('ContactDeliveryService', () => {
  it('sends and marks the claimed submission delivered', async () => {
    const send = vi.fn();
    const claimForDelivery = vi.fn().mockResolvedValue(storedSubmission);
    const markDelivered = vi.fn();
    const service = new ContactDeliveryService(
      { claimForDelivery, markDelivered } as unknown as ContactRepository,
      { send } as unknown as IEmailProvider,
      ['ashuah.tomlin@sugarsocietysc.com', 'admin@sugarsocietysc.com'],
    );

    await service.deliver(storedSubmission.id);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ['ashuah.tomlin@sugarsocietysc.com', 'admin@sugarsocietysc.com'],
      replyTo: 'jamie@example.com',
      subject: 'Website contact: Custom cookies',
      text: expect.stringContaining('<script>alert("hello")</script>'),
      html: expect.stringContaining('&lt;script&gt;'),
    }));
    expect(markDelivered).toHaveBeenCalledWith(storedSubmission.id);
  });

  it('returns failed notifications to pending so SQS can retry', async () => {
    const failure = new Error('SES is unavailable');
    const markDeliveryPending = vi.fn();
    const service = new ContactDeliveryService(
      {
        claimForDelivery: vi.fn().mockResolvedValue(storedSubmission),
        markDeliveryPending,
      } as unknown as ContactRepository,
      { send: vi.fn().mockRejectedValue(failure) } as unknown as IEmailProvider,
      ['admin@sugarsocietysc.com'],
    );

    await expect(service.deliver(storedSubmission.id)).rejects.toBe(failure);
    expect(markDeliveryPending).toHaveBeenCalledWith(storedSubmission.id);
  });

  it('does not send when the submission is already claimed or delivered', async () => {
    const send = vi.fn();
    const service = new ContactDeliveryService(
      { claimForDelivery: vi.fn().mockResolvedValue(undefined) } as unknown as ContactRepository,
      { send } as unknown as IEmailProvider,
      ['admin@sugarsocietysc.com'],
    );

    await service.deliver(storedSubmission.id);

    expect(send).not.toHaveBeenCalled();
  });
});
