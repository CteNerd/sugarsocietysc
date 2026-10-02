import { describe, expect, it, vi } from 'vitest';
import { ContactSubmissionRequest } from '@sugarsocietysc/shared';
import { IEmailProvider } from '../../ports/notification/IEmailProvider';
import { IHumanVerificationProvider } from '../../ports/contact/IHumanVerificationProvider';
import { ContactRepository } from './contact-repository';
import { ContactSubmissionError, ContactService } from './contact-service';

const request: ContactSubmissionRequest = {
  firstName: 'Jamie',
  lastName: 'Baker',
  email: 'jamie@example.com',
  phone: '',
  subject: 'Custom cookies',
  message: '<script>alert("hello")</script>',
  recaptchaToken: 'valid-token',
};

describe('ContactService', () => {
  it('stores a verified message and notifies both configured recipients', async () => {
    const create = vi.fn();
    const send = vi.fn();
    const verify = vi.fn().mockResolvedValue(true);
    const service = new ContactService(
      { create } as unknown as ContactRepository,
      { send } as unknown as IEmailProvider,
      { verify } as unknown as IHumanVerificationProvider,
      ['ashuah.tomlin@sugarsocietysc.com', 'admin@sugarsocietysc.com'],
    );

    await service.submit(request);

    expect(verify).toHaveBeenCalledWith('valid-token');
    expect(create).toHaveBeenCalledWith({
      firstName: 'Jamie',
      lastName: 'Baker',
      email: 'jamie@example.com',
      phone: '',
      subject: 'Custom cookies',
      message: '<script>alert("hello")</script>',
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ['ashuah.tomlin@sugarsocietysc.com', 'admin@sugarsocietysc.com'],
      replyTo: 'jamie@example.com',
      subject: 'Website contact: Custom cookies',
      text: expect.stringContaining('<script>alert("hello")</script>'),
      html: expect.stringContaining('&lt;script&gt;'),
    }));
  });

  it('rejects an unverified token before storing or emailing the message', async () => {
    const create = vi.fn();
    const send = vi.fn();
    const service = new ContactService(
      { create } as unknown as ContactRepository,
      { send } as unknown as IEmailProvider,
      { verify: vi.fn().mockResolvedValue(false) } as unknown as IHumanVerificationProvider,
      ['admin@sugarsocietysc.com'],
    );

    await expect(service.submit(request)).rejects.toThrow(ContactSubmissionError);
    expect(create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
