import { CreatePresaleOrderRequest, PresaleOrderCreateResult } from '@sugarsocietysc/shared';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

async function parseJson(res: Response) {
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return body;
}

/** Phase 4 checkout: works for both signed-in (pass `idToken`) and guest (pass `null` + `guestContact`
 * in the request body) customers. Returns the created order plus the Stripe client secret needed to
 * collect the deposit on this page via Stripe Elements. */
export async function createPresaleOrder(
  idToken: string | null,
  input: CreatePresaleOrderRequest,
): Promise<PresaleOrderCreateResult> {
  const res = await fetch(`${API_BASE_URL}/orders/presale`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}
