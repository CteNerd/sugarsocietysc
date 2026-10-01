import React, { useEffect, useState } from 'react';
import { Order, OrderWithDetails } from '@sugarsocietysc/shared';
import { useAuth } from '../auth/AuthContext';
import { getMyOrder, getMyOrders } from '../api/orders-client';
import LoadingSpinner from '../components/LoadingSpinner';

export default function OrderHistory() {
  const { idToken } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [selected, setSelected] = useState<OrderWithDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) return;
    getMyOrders(idToken).then(setOrders).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load order history');
    });
  }, [idToken]);

  async function openOrder(orderId: string) {
    if (!idToken) return;
    setError(null);
    try {
      setSelected(await getMyOrder(idToken, orderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order details');
    }
  }

  if (error && !orders) return <p className="auth-error">{error}</p>;
  if (!orders) return <LoadingSpinner />;

  return (
    <section className="auth-form-container order-history">
      <h1>My Orders</h1>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {orders.length === 0 ? <p>You do not have any orders yet.</p> : (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              <button type="button" onClick={() => openOrder(order.id)}>
                Order #{order.orderNumber} · {order.status} · {new Date(order.createdAt).toLocaleDateString()}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <article>
          <h2>Order #{selected.order.orderNumber}</h2>
          <p>Status: {selected.order.status}</p>
          <p>Pickup: {new Date(selected.order.pickupDate).toLocaleString()}</p>
          <p>Total: ${(selected.order.total / 100).toFixed(2)}</p>
          <ul>
            {selected.items.map((item) => <li key={item.id}>{item.quantity} cookies · ${(item.lineTotal / 100).toFixed(2)}</li>)}
          </ul>
          <h3>Status history</h3>
          <ul>
            {selected.statusHistory.map((entry) => <li key={entry.id}>{entry.status} — {new Date(entry.changedAt).toLocaleString()}</li>)}
          </ul>
        </article>
      )}
    </section>
  );
}
