import { AppConfig } from '../../config/env';
import { IEmailProvider } from '../../ports/notification/IEmailProvider';
import { SesEmailProvider } from './SesEmailProvider';

export function createEmailProvider(config: AppConfig): IEmailProvider {
  if (!config.newsletterFromEmail) {
    throw new Error('Email sending is not configured: NEWSLETTER_FROM_EMAIL is missing');
  }
  return new SesEmailProvider(config.newsletterFromEmail, config.awsRegion);
}
