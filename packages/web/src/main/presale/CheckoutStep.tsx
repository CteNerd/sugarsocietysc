import React, { useMemo, useState } from 'react';
import { CookieDesign, PackagingOption, PreSaleEvent } from '@sugarsocietysc/shared';
import { formatCents, PackagingSelections, QuantitySelections } from './types';

interface CheckoutStepProps {
  event: PreSaleEvent;
  designs: CookieDesign[];
  packagingOptions: PackagingOption[];
  quantitySelections: QuantitySelections;
  packagingSelections: PackagingSelections;
  isSignedIn: boolean;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (guestContact: { guestEmail: string; guestPhone: string } | undefined) => void;
}

/** Step 3: client-side invoice preview (the API recomputes and is the source of truth) plus guest
 * contact capture for unauthenticated checkout, then kicks off order creation. */
export default function CheckoutStep({
  event,
  designs,
  packagingOptions,
  quantitySelections,
  packagingSelections,
  isSignedIn,
  submitting,
  error,
  onBack,
  onSubmit,
}: CheckoutStepProps) {
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const lineItems = useMemo(
    () =>
      designs
        .filter((d) => (quantitySelections[d.id] ?? 0) > 0)
        .map((d) => ({
          design: d,
          quantity: quantitySelections[d.id],
          lineTotal: quantitySelections[d.id] * d.basePrice,
        })),
    [designs, quantitySelections],
  );

  const box = packagingOptions.find((p) => p.id === packagingSelections.packagingOptionId);
  const addOns = packagingOptions.filter((p) => packagingSelections.addOnOptionIds.includes(p.id));
  const cookiesSubtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const packagingSubtotal = (box?.price ?? 0) + addOns.reduce((sum, a) => sum + a.price, 0);
  const subtotal = cookiesSubtotal + packagingSubtotal;
  const depositAmount = Math.round((subtotal * event.depositPercent) / 100);

  const guestContactValid = guestEmail.trim().length > 0 && guestPhone.trim().length > 0;
  const canSubmit = isSignedIn || guestContactValid;

  function handleSubmit() {
    onSubmit(isSignedIn ? undefined : { guestEmail: guestEmail.trim(), guestPhone: guestPhone.trim() });
  }

  return (
    <div className="presale-step">
      <h2>Review &amp; Pay Deposit</h2>
      <div className="presale-invoice">
        {lineItems.map((item) => (
          <div key={item.design.id} className="presale-invoice-line">
            <span>
              {item.design.name} &times; {item.quantity}
            </span>
            <span>{formatCents(item.lineTotal)}</span>
          </div>
        ))}
        {box && (
          <div className="presale-invoice-line">
            <span>{box.name}</span>
            <span>{formatCents(box.price)}</span>
          </div>
        )}
        {addOns.map((addOn) => (
          <div key={addOn.id} className="presale-invoice-line">
            <span>{addOn.name}</span>
            <span>{formatCents(addOn.price)}</span>
          </div>
        ))}
        <div className="presale-invoice-line presale-invoice-subtotal">
          <span>Subtotal</span>
          <span>{formatCents(subtotal)}</span>
        </div>
        <div className="presale-invoice-line presale-invoice-deposit">
          <span>Deposit due today ({event.depositPercent}%)</span>
          <span>{formatCents(depositAmount)}</span>
        </div>
        <p className="presale-hint">
          Remaining balance of {formatCents(subtotal - depositAmount)} is due at pickup on{' '}
          {new Date(event.pickupDate).toLocaleDateString()}.
        </p>
      </div>

      {!isSignedIn && (
        <div className="presale-guest-contact">
          <h3>Guest Checkout Contact Info</h3>
          <label>
            Email
            <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
          </label>
          <label>
            Phone
            <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required />
          </label>
        </div>
      )}

      {error && <p className="presale-error">{error}</p>}

      <div className="presale-actions">
        <button type="button" className="presale-secondary-button" onClick={onBack} disabled={submitting}>
          Back
        </button>
        <button type="button" className="presale-primary-button" disabled={!canSubmit || submitting} onClick={handleSubmit}>
          {submitting ? 'Placing Order...' : `Pay ${formatCents(depositAmount)} Deposit`}
        </button>
      </div>
    </div>
  );
}
