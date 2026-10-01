export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  orderId: string;
}

export interface PaymentIntentResult {
  providerRef: string;
  clientSecret: string;
}

/** Port for payment processing. Stripe is the first adapter; swappable without caller changes. */
export interface IPaymentProvider {
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  confirmPayment(providerRef: string): Promise<boolean>;
  refund(providerRef: string, amount?: number): Promise<void>;
}
