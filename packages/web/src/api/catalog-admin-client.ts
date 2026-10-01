import {
  CookieDesign,
  CreateCookieDesignRequest,
  CreatePackagingOptionRequest,
  CreatePreSaleEventRequest,
  PackagingOption,
  PreSaleEvent,
  UpdateCookieDesignRequest,
  UpdatePackagingOptionRequest,
  UpdatePreSaleEventRequest,
} from '@sugarsocietysc/shared';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

async function request<T>(idToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return body as T;
}

export function listPreSaleEvents(idToken: string): Promise<PreSaleEvent[]> {
  return request(idToken, '/catalog/admin/presale-events');
}

export function createPreSaleEvent(idToken: string, input: CreatePreSaleEventRequest): Promise<PreSaleEvent> {
  return request(idToken, '/catalog/admin/presale-events', { method: 'POST', body: JSON.stringify(input) });
}

export function updatePreSaleEvent(
  idToken: string,
  id: string,
  input: UpdatePreSaleEventRequest,
): Promise<PreSaleEvent> {
  return request(idToken, `/catalog/admin/presale-events/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function listCookieDesigns(idToken: string): Promise<CookieDesign[]> {
  return request(idToken, '/catalog/admin/cookie-designs');
}

export function createCookieDesign(idToken: string, input: CreateCookieDesignRequest): Promise<CookieDesign> {
  return request(idToken, '/catalog/admin/cookie-designs', { method: 'POST', body: JSON.stringify(input) });
}

export function updateCookieDesign(
  idToken: string,
  id: string,
  input: UpdateCookieDesignRequest,
): Promise<CookieDesign> {
  return request(idToken, `/catalog/admin/cookie-designs/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function listPackagingOptions(idToken: string): Promise<PackagingOption[]> {
  return request(idToken, '/catalog/admin/packaging-options');
}

export function createPackagingOption(
  idToken: string,
  input: CreatePackagingOptionRequest,
): Promise<PackagingOption> {
  return request(idToken, '/catalog/admin/packaging-options', { method: 'POST', body: JSON.stringify(input) });
}

export function updatePackagingOption(
  idToken: string,
  id: string,
  input: UpdatePackagingOptionRequest,
): Promise<PackagingOption> {
  return request(idToken, `/catalog/admin/packaging-options/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}
