import type { AppConfig } from '../../config/env';
import { ISmsProvider } from '../../ports/notification/ISmsProvider';
import { SnsSmsProvider } from './SnsSmsProvider';

/**
 * Open/Closed in practice: adding Twilio later means writing a TwilioSmsProvider
 * implementing ISmsProvider and adding one case below — no caller changes.
 */
export function createSmsProvider(config: AppConfig): ISmsProvider {
  switch (config.smsProvider) {
    case 'sns':
      return new SnsSmsProvider(config.awsRegion);
    default:
      throw new Error(`Unsupported SMS provider: ${config.smsProvider}`);
  }
}
