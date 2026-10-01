import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Order } from '@sugarsocietysc/shared';
import { formatCents } from './types';

// Loaded once at module scope per Stripe's guidance — avoid recreating on every render.
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ?? '');

interface DepositPaymentStepProps {
  order: Order;
  clientSecret: string;
  onSucceeded: () => void;
}

function PaymentForm({ order, onSucceeded }: { order: Order; onSucceeded: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed. Please try again.');
      return;
    }
    onSucceeded();
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="presale-error">{error}</p>}
      <div className="presale-actions">
        <button type="submit" className="presale-primary-button" disabled={!stripe || submitting}>
          {submitting ? 'Processing...' : `Pay ${formatCents(order.depositAmount)} Deposit`}
        </button>
      </div>
    </form>
  );
}

/** Step 4: collects the deposit payment via Stripe Elements using the client secret returned from
 * order creation. The order already exists (status `received`) before this step runs. */
export default function DepositPaymentStep({ order, clientSecret, onSucceeded }: DepositPaymentStepProps) {
  return (
    <div className="presale-step">
      <h2>Order {order.orderNumber} &mdash; Pay Deposit</h2>
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <PaymentForm order={order} onSucceeded={onSucceeded} />
      </Elements>
    </div>
  );
}
