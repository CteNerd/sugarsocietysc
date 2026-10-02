import {
  CookieDesign,
  CreateMenuCategoryRequest,
  CreateMenuItemVariantRequest,
  CreateCookieDesignRequest,
  CreatePackagingOptionRequest,
  CreatePreSaleEventRequest,
  PackagingOption,
  MenuCategory,
  MenuItemVariant,
  PreSaleEvent,
  UpdateCookieDesignRequest,
  UpdateMenuCategoryRequest,
  UpdateMenuItemVariantRequest,
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

export function listCookieDesigns(idToken: string, preSaleEventId?: string): Promise<CookieDesign[]> {
  const query = preSaleEventId ? `?preSaleEventId=${encodeURIComponent(preSaleEventId)}` : '';
  return request(idToken, `/catalog/admin/cookie-designs${query}`);
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

export function listMenuCategories(idToken: string, preSaleEventId: string): Promise<MenuCategory[]> {
  return request(idToken, `/catalog/admin/menu-categories?preSaleEventId=${encodeURIComponent(preSaleEventId)}`);
}

export function createMenuCategory(idToken: string, input: CreateMenuCategoryRequest): Promise<MenuCategory> {
  return request(idToken, '/catalog/admin/menu-categories', { method: 'POST', body: JSON.stringify(input) });
}

export function updateMenuCategory(
  idToken: string,
  id: string,
  input: UpdateMenuCategoryRequest,
): Promise<MenuCategory> {
  return request(idToken, `/catalog/admin/menu-categories/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function listMenuVariants(idToken: string, preSaleEventId: string): Promise<MenuItemVariant[]> {
  return request(idToken, `/catalog/admin/menu-variants?preSaleEventId=${encodeURIComponent(preSaleEventId)}`);
}

export function createMenuVariant(idToken: string, input: CreateMenuItemVariantRequest): Promise<MenuItemVariant> {
  return request(idToken, '/catalog/admin/menu-variants', { method: 'POST', body: JSON.stringify(input) });
}

export function updateMenuVariant(
  idToken: string,
  id: string,
  input: UpdateMenuItemVariantRequest,
): Promise<MenuItemVariant> {
  return request(idToken, `/catalog/admin/menu-variants/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function listEventPackaging(idToken: string, eventId: string): Promise<PackagingOption[]> {
  return request(idToken, `/catalog/admin/presale-events/${eventId}/packaging`);
}

export function setEventPackaging(
  idToken: string,
  eventId: string,
  packagingOptionIds: string[],
): Promise<PackagingOption[]> {
  return request(idToken, `/catalog/admin/presale-events/${eventId}/packaging`, {
    method: 'PUT',
    body: JSON.stringify({ packagingOptionIds }),
  });
}

export async function uploadMenuItemImage(idToken: string, file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose a JPEG, PNG, or WebP image no larger than 5 MB.');
  }
  const { uploadUrl, imageUrl } = await request<{ uploadUrl: string; imageUrl: string }>(
    idToken,
    '/catalog/admin/menu-item-images/upload-url',
    {
      method: 'POST',
      body: JSON.stringify({ contentType: file.type, contentLength: file.size }),
    },
  );
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Image upload failed (${uploadResponse.status})`);
  }
  return imageUrl;
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
