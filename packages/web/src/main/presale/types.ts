export type WizardStep = 'browse' | 'packaging' | 'checkout' | 'payment' | 'confirmation';

/** Number of packs selected per variant, keyed by variant id. */
export type QuantitySelections = Record<string, number>;

export interface PackagingSelections {
  packagingOptionId: string | null;
  addOnOptionIds: string[];
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
