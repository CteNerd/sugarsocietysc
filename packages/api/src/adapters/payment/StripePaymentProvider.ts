import Stripe from 'stripe';
import {
  CreatePaymentIntentParams,
  IPaymentProvider,
  PaymentIntentResult,
} from '../../ports/payment/IPaymentProvider';

export class StripePaymentProvider implements IPaymentProvider {
  private readonly client: Stripe;

  constructor(secretKey: string) {
    this.client = new Stripe(secretKey);
  }

  async createPaymentIntent({
    amount,
    currency,
    orderId,
  }: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const intent = await this.client.paymentIntents.create({
      amount,
      currency,
      metadata: { orderId },
      // This is a single-page app with no dedicated redirect-return page, so disable
      // redirect-based payment methods (Klarna, Cash App, Amazon Pay, etc.) and keep
      // payment entirely in-page. Also avoids Stripe's return_url requirement.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
    return { providerRef: intent.id, clientSecret: intent.client_secret ?? '' };
  }

  async confirmPayment(providerRef: string): Promise<boolean> {
    const intent = await this.client.paymentIntents.retrieve(providerRef);
    return intent.status === 'succeeded';
  }

  async refund(providerRef: string, amount?: number): Promise<void> {
    await this.client.refunds.create({ payment_intent: providerRef, amount });
  }
}
