import { CookieDesign, PackagingOption, PreSaleEvent } from '@sugarsocietysc/shared';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

export interface ActivePreSaleSnapshot {
  event: PreSaleEvent;
  designs: CookieDesign[];
  packagingOptions: PackagingOption[];
}

async function parseJson(res: Response) {
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return body;
}

/** Public: the active Pre-Sale event plus its sellable designs and packaging — everything the Phase 4
 * storefront needs to render the browse/quantity/packaging steps. Returns undefined when no Pre-Sale
 * is currently active (404). */
export async function getActivePreSale(): Promise<ActivePreSaleSnapshot | undefined> {
  const res = await fetch(`${API_BASE_URL}/catalog/presale/active`);
  if (res.status === 404) {
    return undefined;
  }
  return parseJson(res);
}
