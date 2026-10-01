import type { AppConfig } from '../../config/env';
import { IPaymentProvider } from '../../ports/payment/IPaymentProvider';
import { StripePaymentProvider } from './StripePaymentProvider';

/** Mirrors `createSmsProvider` — swapping payment vendors later is one new adapter + one case here. */
export function createPaymentProvider(config: AppConfig): IPaymentProvider {
  switch (config.paymentProvider) {
    case 'stripe':
      return new StripePaymentProvider(config.stripeSecretKey, config.stripeWebhookSecret);
    default:
      throw new Error(`Unsupported payment provider: ${config.paymentProvider}`);
  }
}
