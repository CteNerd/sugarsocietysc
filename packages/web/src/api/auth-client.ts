import { User } from '@sugarsocietysc/shared';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

export interface SyncProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  newsletterOptInEmail?: boolean;
  newsletterOptInSms?: boolean;
}

export class AuthApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function parseJson(res: Response): Promise<User> {
  const body = await res.json();
  if (!res.ok) {
    throw new AuthApiError(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`, res.status);
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
