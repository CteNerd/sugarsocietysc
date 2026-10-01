import React, { useEffect, useState } from 'react';
import { Order } from '@sugarsocietysc/shared';
import { useAuth } from '../../auth/AuthContext';
import { ActivePreSaleSnapshot, getActivePreSale } from '../../api/catalog-client';
import { createPresaleOrder } from '../../api/orders-client';
import LoadingSpinner from '../../components/LoadingSpinner';
import QuantityStep from './QuantityStep';
import PackagingStep from './PackagingStep';
import CheckoutStep from './CheckoutStep';
import DepositPaymentStep from './DepositPaymentStep';
import { PackagingSelections, QuantitySelections, WizardStep } from './types';
import './presale.css';

export default function PreSale() {
  const { idToken } = useAuth();
  const [snapshot, setSnapshot] = useState<ActivePreSaleSnapshot | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<WizardStep>('browse');
  const [quantitySelections, setQuantitySelections] = useState<QuantitySelections>({});
  const [packagingSelections, setPackagingSelections] = useState<PackagingSelections>({
    packagingOptionId: null,
    addOnOptionIds: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | undefined>();
  const [clientSecret, setClientSecret] = useState<string | undefined>();

  useEffect(() => {
    getActivePreSale()
      .then(setSnapshot)
      .catch(() => setLoadError('Unable to load the Pre-Sale right now. Please try again shortly.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (loadError) {
    return (
      <div className="presale-page">
        <p className="presale-error">{loadError}</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="presale-page">
        <h1>No Pre-Sale Is Active Right Now</h1>
        <p>Check back soon&mdash;follow us on social media for the next announcement!</p>
      </div>
    );
  }

  const { event, designs, packagingOptions } = snapshot;

  async function handleCheckoutSubmit(guestContact: { guestEmail: string; guestPhone: string } | undefined) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createPresaleOrder(idToken, {
        preSaleEventId: event.id,
        items: Object.entries(quantitySelections)
          .filter(([, quantity]) => quantity > 0)
          .map(([cookieDesignId, quantity]) => ({ cookieDesignId, quantity })),
        packagingOptionId: packagingSelections.packagingOptionId as string,
        addOnOptionIds: packagingSelections.addOnOptionIds,
        guestContact,
      });
      setCreatedOrder(result.order);
      setClientSecret(result.stripeClientSecret);
      setStep('payment');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong placing your order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="presale-page">
      <div className="presale-header">
        <h1>{event.name} Pre-Sale</h1>
        <p className="presale-hint">
          Pickup on {new Date(event.pickupDate).toLocaleDateString()}. Orders open through{' '}
          {new Date(event.orderWindowEnd).toLocaleDateString()}.
        </p>
      </div>

      {step === 'browse' && (
        <QuantityStep
          designs={designs}
          selections={quantitySelections}
          onChange={(designId, quantity) =>
            setQuantitySelections((prev) => ({ ...prev, [designId]: quantity }))
          }
          onContinue={() => setStep('packaging')}
        />
      )}

      {step === 'packaging' && (
        <PackagingStep
          packagingOptions={packagingOptions}
          selections={packagingSelections}
          onChange={setPackagingSelections}
          onBack={() => setStep('browse')}
          onContinue={() => setStep('checkout')}
        />
      )}

      {step === 'checkout' && (
        <CheckoutStep
          event={event}
          designs={designs}
          packagingOptions={packagingOptions}
          quantitySelections={quantitySelections}
          packagingSelections={packagingSelections}
          isSignedIn={Boolean(idToken)}
          submitting={submitting}
          error={submitError}
          onBack={() => setStep('packaging')}
          onSubmit={handleCheckoutSubmit}
        />
      )}

      {step === 'payment' && createdOrder && clientSecret && (
        <DepositPaymentStep order={createdOrder} clientSecret={clientSecret} onSucceeded={() => setStep('confirmation')} />
      )}

      {step === 'confirmation' && createdOrder && (
        <div className="presale-step">
          <h2>Thank You!</h2>
          <p>
            Your order <strong>{createdOrder.orderNumber}</strong> is confirmed. We&apos;ll see you for pickup on{' '}
            {new Date(createdOrder.pickupDate).toLocaleDateString()}.
          </p>
        </div>
      )}
    </div>
  );
}
