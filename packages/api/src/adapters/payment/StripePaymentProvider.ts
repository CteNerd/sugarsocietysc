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
