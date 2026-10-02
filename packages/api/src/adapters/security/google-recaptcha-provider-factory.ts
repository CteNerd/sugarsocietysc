import { AppConfig } from '../../config/env';
import { IHumanVerificationProvider } from '../../ports/contact/IHumanVerificationProvider';
import { GoogleRecaptchaProvider } from './GoogleRecaptchaProvider';

export function createHumanVerificationProvider(config: AppConfig): IHumanVerificationProvider {
  return new GoogleRecaptchaProvider(config.googleRecaptchaSecret);
}
