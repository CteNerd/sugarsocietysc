import { ContactSubmissionRequest } from '@sugarsocietysc/shared';
import { IEmailProvider } from '../../ports/notification/IEmailProvider';
import { IHumanVerificationProvider } from '../../ports/contact/IHumanVerificationProvider';
import { ContactRepository } from './contact-repository';

export class ContactSubmissionError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
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
    private readonly emailProvider: IEmailProvider,
    private readonly verificationProvider: IHumanVerificationProvider,
    private readonly recipients: string[],
  ) {}

  async submit(input: ContactSubmissionRequest): Promise<void> {
    if (!await this.verificationProvider.verify(input.recaptchaToken)) {
      throw new ContactSubmissionError('Please complete the reCAPTCHA check and try again.');
    }

    const { recaptchaToken: _recaptchaToken, ...submission } = input;
    await this.repository.create(submission);

    const fullName = `${submission.firstName} ${submission.lastName}`;
    const details = [
      ['Name', fullName],
      ['Email', submission.email],
      ['Phone', submission.phone || 'Not provided'],
      ['Subject', submission.subject],
      ['Message', submission.message || 'Not provided'],
    ] as const;
    const text = details.map(([label, value]) => `${label}: ${value}`).join('\n\n');
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5">${details
      .map(([label, value]) => `<p><strong>${label}:</strong><br>${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`)
      .join('')}</div>`;

    await this.emailProvider.send({
      to: this.recipients,
      replyTo: submission.email,
      subject: `Website contact: ${submission.subject}`,
      text,
      html,
    });
  }
}
