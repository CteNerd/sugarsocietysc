import {
  AdminOrderWithDetails,
  CreatePresaleOrderRequest,
  Order,
  OrderStatus,
  OrderWithDetails,
  PresaleOrderCreateResult,
} from '@sugarsocietysc/shared';

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

export async function getMyOrders(idToken: string): Promise<Order[]> {
  const res = await fetch(`${API_BASE_URL}/orders/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseJson(res);
}

export async function getMyOrder(idToken: string, orderId: string): Promise<OrderWithDetails> {
  const res = await fetch(`${API_BASE_URL}/orders/me/${orderId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseJson(res);
}

export async function getAdminOrders(idToken: string): Promise<Order[]> {
  const res = await fetch(`${API_BASE_URL}/orders/admin`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseJson(res);
}

export async function getAdminOrder(idToken: string, orderId: string): Promise<AdminOrderWithDetails> {
  const res = await fetch(`${API_BASE_URL}/orders/admin/${orderId}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseJson(res);
}

export async function updateAdminOrderStatus(
  idToken: string,
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<Order> {
  const res = await fetch(`${API_BASE_URL}/orders/admin/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ status, note }),
  });
  return parseJson(res);
}
