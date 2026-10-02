import React from 'react';
import { MenuCategoryWithItems, MenuItemWithVariants } from '@sugarsocietysc/shared';
import { formatCents, QuantitySelections } from './types';

interface QuantityStepProps {
  categories: MenuCategoryWithItems[];
  uncategorizedItems: MenuItemWithVariants[];
  selections: QuantitySelections;
  onChange: (variantId: string, packs: number) => void;
  onContinue: () => void;
}

export default function QuantityStep({
  categories,
  uncategorizedItems,
  selections,
  onChange,
  onContinue,
}: QuantityStepProps) {
  const packCount = Object.values(selections).reduce((sum, packs) => sum + packs, 0);

  function renderItems(items: MenuItemWithVariants[]) {
    return (
      <div className="presale-design-grid">
        {items.map((item) => {
          const selectedUnits = item.variants.reduce(
            (sum, variant) => sum + (selections[variant.id] ?? 0) * variant.packSize,
            0,
          );
          const availableUnits =
            item.maxQuantity === undefined ? undefined : Math.max(item.maxQuantity - item.quantitySold, 0);
          return (
            <article key={item.id} className="presale-design-card">
              {item.imageUrls[0] && <img className="presale-design-image" src={item.imageUrls[0]} alt={item.name} />}
              <h3>{item.name}</h3>
              {item.description && <p>{item.description}</p>}
              {item.variants.map((variant) => {
                const packs = selections[variant.id] ?? 0;
                const otherUnits = selectedUnits - packs * variant.packSize;
                const maxPacks =
                  availableUnits === undefined
                    ? 100
                    : Math.min(100, Math.max(0, Math.floor((availableUnits - otherUnits) / variant.packSize)));
                const soldOut = maxPacks === 0;
                const label = variant.label ?? `${variant.packSize} pack`;
                return (
                  <div key={variant.id} className="presale-variant-row">
                    <div>
                      <strong>{label}</strong>
                      <p className="presale-design-price">{formatCents(variant.priceCents)} / pack</p>
                    </div>
                    {soldOut ? (
                      <span className="presale-sold-out-label">Sold Out</span>
                    ) : (
                      <div className="presale-quantity-stepper">
                        <button
                          type="button"
                          aria-label={`Decrease ${label} quantity for ${item.name}`}
                          disabled={packs <= 0}
                          onClick={() => onChange(variant.id, packs - 1)}
                        >
                          &minus;
                        </button>
                        <span className="presale-quantity-value">{packs}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${label} quantity for ${item.name}`}
                          disabled={packs >= maxPacks}
                          onClick={() => onChange(variant.id, packs + 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {availableUnits !== undefined && (
                <p className="presale-hint">{Math.max(availableUnits - selectedUnits, 0)} cookies remaining</p>
              )}
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="presale-step">
      <h2>Choose Your Packs</h2>
      <p className="presale-hint">Choose a pack size and quantity for each item.</p>
      {categories.map((category) => (
        <section className="presale-menu-category" key={category.id}>
          <h3>{category.name}</h3>
          {category.description && <p>{category.description}</p>}
          {renderItems(category.items)}
        </section>
      ))}
      {uncategorizedItems.length > 0 && (
        <section className="presale-menu-category">
          <h3>More Treats</h3>
          {renderItems(uncategorizedItems)}
        </section>
      )}
      <div className="presale-actions">
        <p className="presale-total-cookies">Total: {packCount} packs</p>
        <button type="button" className="presale-primary-button" disabled={packCount === 0} onClick={onContinue}>
          Continue to Packaging
        </button>
      </div>
    </div>
  );
}
