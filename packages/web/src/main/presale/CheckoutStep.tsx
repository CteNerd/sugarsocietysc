import React, { useMemo, useState } from 'react';
import { PreSaleEventMenu } from '@sugarsocietysc/shared';
import { formatCents, PackagingSelections, QuantitySelections } from './types';

interface CheckoutStepProps {
  menu: PreSaleEventMenu;
  quantitySelections: QuantitySelections;
  packagingSelections: PackagingSelections;
  isSignedIn: boolean;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (guestContact: { guestEmail: string; guestPhone: string } | undefined) => void;
}

export default function CheckoutStep({
  menu,
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
  const items = useMemo(
    () => [...menu.categories.flatMap((category) => category.items), ...menu.uncategorizedItems],
    [menu],
  );
  const lineItems = items.flatMap((item) =>
    item.variants
      .filter((variant) => (quantitySelections[variant.id] ?? 0) > 0)
      .map((variant) => ({
        id: variant.id,
        name: item.name,
        variantLabel: variant.label ?? `${variant.packSize} pack`,
        packs: quantitySelections[variant.id],
        lineTotal: quantitySelections[variant.id] * variant.priceCents,
      })),
  );
  const packagingOption = menu.packagingOptions.find((option) => option.id === packagingSelections.packagingOptionId);
  const addOns = menu.packagingOptions.filter((option) => packagingSelections.addOnOptionIds.includes(option.id));
  const itemSubtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const packagingSubtotal = (packagingOption?.price ?? 0) + addOns.reduce((sum, option) => sum + option.price, 0);
  const subtotal = itemSubtotal + packagingSubtotal;
  const depositAmount = Math.round((subtotal * menu.event.depositPercent) / 100);

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
          <div key={item.id} className="presale-invoice-line">
            <span>
              {item.name} — {item.variantLabel} &times; {item.packs} pack{item.packs === 1 ? '' : 's'}
            </span>
            <span>{formatCents(item.lineTotal)}</span>
          </div>
        ))}
        {packagingOption && (
          <div className="presale-invoice-line">
            <span>{packagingOption.name}</span>
            <span>{formatCents(packagingOption.price)}</span>
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
          <span>Deposit due today ({menu.event.depositPercent}%)</span>
          <span>{formatCents(depositAmount)}</span>
        </div>
        <p className="presale-hint">
          Remaining balance of {formatCents(subtotal - depositAmount)} is due at pickup on{' '}
          {new Date(menu.event.pickupDate).toLocaleDateString()}.
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
