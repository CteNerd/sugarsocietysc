import { ContactSubmissionRequest } from '@sugarsocietysc/shared';
import { IEmailProvider } from '../../ports/notification/IEmailProvider';
import { IHumanVerificationProvider } from '../../ports/contact/IHumanVerificationProvider';
import { IContactQueue } from '../../ports/contact/IContactQueue';
import { ContactRepository } from './contact-repository';

export class ContactSubmissionError extends Error {
  constructor(message: string, readonly statusCode: 400 | 409 = 400) {
    super(message);
  }
}

export class ContactDeliveryService {
  constructor(
    private readonly repository: ContactRepository,
    private readonly emailProvider: IEmailProvider,
    private readonly recipients: string[],
  ) {}

  async deliver(submissionId: string): Promise<void> {
    const submission = await this.repository.claimForDelivery(submissionId);
    if (!submission) {
      return;
    }

    const details = [
      ['Name', `${submission.firstName} ${submission.lastName}`],
      ['Email', submission.email],
      ['Phone', submission.phone || 'Not provided'],
      ['Subject', submission.subject],
      ['Message', submission.message || 'Not provided'],
    ] as const;
    const text = details.map(([label, value]) => `${label}: ${value}`).join('\n\n');
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5">${details
      .map(([label, value]) => `<p><strong>${label}:</strong><br>${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`)
      .join('')}</div>`;

    try {
      await this.emailProvider.send({
        to: this.recipients,
        replyTo: submission.email,
        subject: `Website contact: ${submission.subject}`,
        text,
        html,
      });
      await this.repository.markDelivered(submission.id);
    } catch (error) {
      await this.repository.markDeliveryPending(submission.id);
      throw error;
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export class ContactService {
  constructor(
    private readonly repository: ContactRepository,
    private readonly verificationProvider: IHumanVerificationProvider,
    private readonly queue: IContactQueue,
  ) {}

  async submit(input: ContactSubmissionRequest): Promise<void> {
    if (!await this.verificationProvider.verify(input.recaptchaToken)) {
      throw new ContactSubmissionError('Please complete the reCAPTCHA check and try again.');
    }

    const { recaptchaToken: _recaptchaToken, ...submission } = input;
    let storedSubmission;
    try {
      storedSubmission = await this.repository.createOrFind(submission);
    } catch (error) {
      if (error instanceof Error && error.message === 'Contact request ID was reused with different form data') {
        throw new ContactSubmissionError(error.message, 409);
      }
      throw error;
    }

    if (storedSubmission.emailStatus !== 'sent') {
      await this.queue.enqueue(storedSubmission.id);
    }
  }
}
