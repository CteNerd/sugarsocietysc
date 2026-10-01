export type WizardStep = 'browse' | 'packaging' | 'checkout' | 'payment' | 'confirmation';

/** Quantity selected per cookie design, keyed by design id. Only designs with quantity > 0 are
 * included in the final order submission. */
export type QuantitySelections = Record<string, number>;

export interface PackagingSelections {
  packagingOptionId: string | null;
  addOnOptionIds: string[];
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
