import { PreSaleEventMenu, PreSaleEventSummary } from '@sugarsocietysc/shared';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return body as T;
}

export async function listPublicPreSaleEvents(): Promise<PreSaleEventSummary[]> {
  const response = await fetch(`${API_BASE_URL}/catalog/presale/events`);
  return parseJson(response);
}

export async function getPreSaleEventMenu(eventId: string): Promise<PreSaleEventMenu> {
  const response = await fetch(`${API_BASE_URL}/catalog/presale/events/${encodeURIComponent(eventId)}`);
  return parseJson(response);
}
