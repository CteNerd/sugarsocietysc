import { User } from '@sugarsocietysc/shared';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

export interface SyncProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  newsletterOptInEmail?: boolean;
  newsletterOptInSms?: boolean;
}

async function parseJson(res: Response) {
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return body;
}

/** Upserts the signed-in user's Postgres profile — called after signup confirmation and on every login. */
export async function syncProfile(idToken: string, input: SyncProfileInput): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function getCurrentUser(idToken: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth-sync/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseJson(res);
}
