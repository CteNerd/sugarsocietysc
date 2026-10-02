import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Order, PreSaleEventMenu } from '@sugarsocietysc/shared';
import { useAuth } from '../../auth/AuthContext';
import { getPreSaleEventMenu } from '../../api/catalog-client';
import { createPresaleOrder } from '../../api/orders-client';
import LoadingSpinner from '../../components/LoadingSpinner';
import QuantityStep from './QuantityStep';
import PackagingStep from './PackagingStep';
import CheckoutStep from './CheckoutStep';
import DepositPaymentStep from './DepositPaymentStep';
import { PackagingSelections, QuantitySelections, WizardStep } from './types';

export default function EventOrder() {
  const { eventId } = useParams();
  const { idToken } = useAuth();
  const [menu, setMenu] = useState<PreSaleEventMenu>();
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
  const [createdOrder, setCreatedOrder] = useState<Order>();
  const [clientSecret, setClientSecret] = useState<string>();

  useEffect(() => {
    if (!eventId) {
      setLoadError('Pre-Sale event not found.');
      setLoading(false);
      return;
    }
    getPreSaleEventMenu(eventId)
      .then(setMenu)
      .catch(() => setLoadError('Unable to load this Pre-Sale menu. It may have ended or been removed.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  async function handleCheckoutSubmit(guestContact: { guestEmail: string; guestPhone: string } | undefined) {
    if (!menu) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createPresaleOrder(idToken, {
        preSaleEventId: menu.event.id,
        items: Object.entries(quantitySelections)
          .filter(([, packs]) => packs > 0)
          .map(([variantId, packs]) => ({ variantId, packs })),
        ...(packagingSelections.packagingOptionId
          ? { packagingOptionId: packagingSelections.packagingOptionId }
          : {}),
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

  if (loading) return <LoadingSpinner />;
  if (loadError || !menu) {
    return (
      <div className="presale-page">
        <p className="presale-error" role="alert">{loadError ?? 'Pre-Sale event not found.'}</p>
        <Link to="/pre-sale">Back to Pre-Sales</Link>
      </div>
    );
  }

  if (menu.event.status !== 'open') {
    return (
      <div className="presale-page">
        <div className="presale-header">
          <Link to="/pre-sale">← All Pre-Sales</Link>
          <h1>{menu.event.name}</h1>
          <p className="presale-event-status">Coming soon</p>
          <p>Orders open {new Date(menu.event.orderWindowStart).toLocaleDateString()}.</p>
          <p>Pickup on {new Date(menu.event.pickupDate).toLocaleDateString()}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="presale-page">
      <div className="presale-header">
        <Link to="/pre-sale">← All Pre-Sales</Link>
        <h1>{menu.event.name}</h1>
        <p className="presale-hint">
          Pickup on {new Date(menu.event.pickupDate).toLocaleDateString()}. Orders close{' '}
          {new Date(menu.event.orderWindowEnd).toLocaleDateString()}.
        </p>
      </div>

      {step === 'browse' && (
        <QuantityStep
          categories={menu.categories}
          uncategorizedItems={menu.uncategorizedItems}
          selections={quantitySelections}
          onChange={(variantId, packs) =>
            setQuantitySelections((current) => ({ ...current, [variantId]: Math.max(0, packs) }))
          }
          onContinue={() => setStep('packaging')}
        />
      )}
      {step === 'packaging' && (
        <PackagingStep
          packagingOptions={menu.packagingOptions}
          selections={packagingSelections}
          onChange={setPackagingSelections}
          onBack={() => setStep('browse')}
          onContinue={() => setStep('checkout')}
        />
      )}
      {step === 'checkout' && (
        <CheckoutStep
          menu={menu}
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
        <DepositPaymentStep
          order={createdOrder}
          clientSecret={clientSecret}
          onSucceeded={() => setStep('confirmation')}
        />
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
