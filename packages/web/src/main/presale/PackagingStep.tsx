import React from 'react';
import { PackagingOption } from '@sugarsocietysc/shared';
import { formatCents, PackagingSelections } from './types';

interface PackagingStepProps {
  packagingOptions: PackagingOption[];
  selections: PackagingSelections;
  onChange: (selections: PackagingSelections) => void;
  onBack: () => void;
  onContinue: () => void;
}

/** Step 2: pick exactly one box (required) and any number of add-ons. */
export default function PackagingStep({ packagingOptions, selections, onChange, onBack, onContinue }: PackagingStepProps) {
  const boxes = packagingOptions.filter((p) => p.type === 'box');
  const addOns = packagingOptions.filter((p) => p.type === 'addon');
  const canContinue = selections.packagingOptionId !== null;

  function toggleAddOn(id: string) {
    const addOnOptionIds = selections.addOnOptionIds.includes(id)
      ? selections.addOnOptionIds.filter((existing) => existing !== id)
      : [...selections.addOnOptionIds, id];
    onChange({ ...selections, addOnOptionIds });
  }

  return (
    <div className="presale-step">
      <h2>Choose Your Packaging</h2>
      <div className="presale-packaging-group">
        <h3>Box</h3>
        {boxes.map((box) => (
          <label key={box.id} className="presale-packaging-option">
            <input
              type="radio"
              name="packaging-box"
              checked={selections.packagingOptionId === box.id}
              onChange={() => onChange({ ...selections, packagingOptionId: box.id })}
            />
            {box.name} &mdash; {formatCents(box.price)}
          </label>
        ))}
      </div>
      {addOns.length > 0 && (
        <div className="presale-packaging-group">
          <h3>Add-Ons (optional)</h3>
          {addOns.map((addOn) => (
            <label key={addOn.id} className="presale-packaging-option">
              <input
                type="checkbox"
                checked={selections.addOnOptionIds.includes(addOn.id)}
                onChange={() => toggleAddOn(addOn.id)}
              />
              {addOn.name} &mdash; {formatCents(addOn.price)}
            </label>
          ))}
        </div>
      )}
      <div className="presale-actions">
        <button type="button" className="presale-secondary-button" onClick={onBack}>
          Back
        </button>
        <button type="button" className="presale-primary-button" disabled={!canContinue} onClick={onContinue}>
          Continue to Invoice
        </button>
      </div>
    </div>
  );
}
