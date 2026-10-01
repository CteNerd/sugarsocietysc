import React from 'react';
import { CookieDesign } from '@sugarsocietysc/shared';
import { formatCents, QuantitySelections } from './types';

const QUANTITY_STEP = 6;

interface QuantityStepProps {
  designs: CookieDesign[];
  selections: QuantitySelections;
  onChange: (designId: string, quantity: number) => void;
  onContinue: () => void;
}

/** Step 1: browse active Pre-Sale designs and pick a quantity for each, always in multiples of 6. */
export default function QuantityStep({ designs, selections, onChange, onContinue }: QuantityStepProps) {
  const totalCookies = Object.values(selections).reduce((sum, qty) => sum + qty, 0);
  const canContinue = totalCookies > 0;

  function remaining(design: CookieDesign): number | undefined {
    if (design.maxQuantity === undefined) {
      return undefined;
    }
    return Math.max(design.maxQuantity - design.quantitySold, 0);
  }

  function step(design: CookieDesign, delta: number) {
    const current = selections[design.id] ?? 0;
    const next = Math.max(0, current + delta * QUANTITY_STEP);
    const max = remaining(design);
    onChange(design.id, max !== undefined ? Math.min(next, Math.floor(max / QUANTITY_STEP) * QUANTITY_STEP) : next);
  }

  return (
    <div className="presale-step">
      <h2>Choose Your Cookies</h2>
      <p className="presale-hint">Cookies are sold by the dozen&mdash;select quantities in multiples of 6.</p>
      <div className="presale-design-grid">
        {designs.map((design) => {
          const left = remaining(design);
          const soldOut = left !== undefined && left < QUANTITY_STEP;
          const qty = selections[design.id] ?? 0;
          return (
            <div key={design.id} className={`presale-design-card${soldOut ? ' sold-out' : ''}`}>
              {design.imageUrls[0] && (
                <img className="presale-design-image" src={design.imageUrls[0]} alt={design.name} />
              )}
              <h3>{design.name}</h3>
              <p className="presale-design-price">{formatCents(design.basePrice)} / cookie</p>
              {soldOut ? (
                <p className="presale-sold-out-label">Sold Out</p>
              ) : (
                <div className="presale-quantity-stepper">
                  <button
                    type="button"
                    aria-label={`Decrease quantity for ${design.name}`}
                    disabled={qty <= 0}
                    onClick={() => step(design, -1)}
                  >
                    &minus;
                  </button>
                  <span className="presale-quantity-value">{qty}</span>
                  <button type="button" aria-label={`Increase quantity for ${design.name}`} onClick={() => step(design, 1)}>
                    +
                  </button>
                </div>
              )}
              {left !== undefined && !soldOut && <p className="presale-hint">{left} left</p>}
            </div>
          );
        })}
      </div>
      <div className="presale-actions">
        <p className="presale-total-cookies">Total: {totalCookies} cookies</p>
        <button type="button" className="presale-primary-button" disabled={!canContinue} onClick={onContinue}>
          Continue to Packaging
        </button>
      </div>
    </div>
  );
}
