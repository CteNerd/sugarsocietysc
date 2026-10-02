import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CreateNewsletterCampaignRequest,
  NewsletterCampaign,
  NewsletterSendLog,
  Order,
  OrderStatus,
  AdminOrderWithDetails,
  PackagingOption,
  PreSaleEvent,
} from '@sugarsocietysc/shared';
import { useAuth } from '../auth/AuthContext';
import {
  createPackagingOption,
  createPreSaleEvent,
  listPackagingOptions,
  listPreSaleEvents,
  updatePackagingOption,
  updatePreSaleEvent,
} from '../api/catalog-admin-client';
import MenuManagement from './MenuManagement';
import { getAdminOrder, getAdminOrders, updateAdminOrderStatus } from '../api/orders-client';
import {
  createNewsletterCampaign,
  getNewsletterCampaignLogs,
  listNewsletterCampaigns,
  sendNewsletterCampaign,
} from '../api/newsletter-client';
import './admin.css';

const statuses: OrderStatus[] = ['received', 'payment_received', 'ready_for_pickup', 'complete', 'cancelled'];

function dateInput(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function cents(value: FormDataEntryValue | null): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Enter a valid price.');
  }
  return Math.round(amount * 100);
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim();
}

function check(form: FormData, name: string): boolean {
  return form.get(name) === 'on';
}

function packagingType(form: FormData): PackagingOption['type'] {
  const type = text(form, 'type');
  if (type === 'box' || type === 'addon') return type;
  throw new Error('Select a valid packaging type.');
}

function orderStatus(form: FormData): OrderStatus {
  const status = text(form, 'status');
  const matched = statuses.find((candidate) => candidate === status);
  if (matched) return matched;
  throw new Error('Select a valid order status.');
}

export default function AdminDashboard() {
  const { idToken } = useAuth();
  const [events, setEvents] = useState<PreSaleEvent[]>([]);
  const [packaging, setPackaging] = useState<PackagingOption[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([]);
  const [campaignLogs, setCampaignLogs] = useState<Record<string, NewsletterSendLog[]>>({});
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderWithDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refreshCatalog = useCallback(async () => {
    if (!idToken) return;
    const [nextEvents, nextPackaging] = await Promise.all([
      listPreSaleEvents(idToken),
      listPackagingOptions(idToken),
    ]);
    setEvents(nextEvents);
    setPackaging(nextPackaging);
  }, [idToken]);

  const refreshOrders = useCallback(async () => {
    if (idToken) setOrders(await getAdminOrders(idToken));
  }, [idToken]);

  const refreshCampaigns = useCallback(async () => {
    if (idToken) setCampaigns(await listNewsletterCampaigns(idToken));
  }, [idToken]);

  useEffect(() => {
    Promise.all([refreshCatalog(), refreshOrders(), refreshCampaigns()]).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load admin data');
    });
  }, [refreshCatalog, refreshOrders, refreshCampaigns]);

  async function submit(
    e: FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<void>,
    successMessage: string,
  ) {
    e.preventDefault();
    if (!idToken) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const formElement = e.currentTarget;
    try {
      await action(new FormData(formElement));
      setNotice(successMessage);
      formElement.reset();
      await refreshCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The change could not be saved');
    } finally {
      setSaving(false);
    }
  }

  async function updateEvent(event: PreSaleEvent, form: FormData) {
    if (!idToken) return;
    await updatePreSaleEvent(idToken, event.id, {
      name: text(form, 'name'),
      holidayTag: text(form, 'holidayTag'),
      orderWindowStart: new Date(text(form, 'orderWindowStart')).toISOString(),
      orderWindowEnd: new Date(text(form, 'orderWindowEnd')).toISOString(),
      pickupDate: new Date(text(form, 'pickupDate')).toISOString(),
      depositPercent: Number(text(form, 'depositPercent')),
      isActive: check(form, 'isActive'),
    });
  }

  async function updatePackage(option: PackagingOption, form: FormData) {
    if (!idToken) return;
    await updatePackagingOption(idToken, option.id, {
      name: text(form, 'name'),
      price: cents(form.get('price')),
      type: packagingType(form),
      isActive: check(form, 'isActive'),
    });
  }

  async function openOrder(order: Order) {
    if (!idToken) return;
    setError(null);
    try {
      setSelectedOrder(await getAdminOrder(idToken, order.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order details');
    }
  }

  async function saveOrderStatus(form: FormData) {
    if (!idToken || !selectedOrder) return;
    await updateAdminOrderStatus(
      idToken,
      selectedOrder.order.id,
      orderStatus(form),
      text(form, 'note') || undefined,
    );
    setSelectedOrder(await getAdminOrder(idToken, selectedOrder.order.id));
    await refreshOrders();
  }

  async function createCampaign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!idToken) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const campaign: CreateNewsletterCampaignRequest = {
      title: text(data, 'title'),
      subject: text(data, 'subject'),
      bodyText: text(data, 'bodyText'),
      smsBody: text(data, 'smsBody') || undefined,
      sendEmail: check(data, 'sendEmail'),
      sendSms: check(data, 'sendSms'),
    };
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await createNewsletterCampaign(idToken, campaign);
      form.reset();
      await refreshCampaigns();
      setNotice('Campaign draft created. Review it below and send when ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create campaign');
    } finally {
      setSaving(false);
    }
  }

  async function sendCampaign(campaign: NewsletterCampaign) {
    if (!idToken) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await sendNewsletterCampaign(idToken, campaign.id);
      await refreshCampaigns();
      setNotice(`Campaign "${campaign.title}" was queued for delivery.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue campaign');
    } finally {
      setSaving(false);
    }
  }

  async function refreshCampaignLogs(campaignId: string) {
    if (!idToken) return;
    setError(null);
    try {
      const logs = await getNewsletterCampaignLogs(idToken, campaignId);
      setCampaignLogs((current) => ({ ...current, [campaignId]: logs }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load campaign send log');
    }
  }

  return (
    <main className="admin-page">
      <h1>Admin Dashboard</h1>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-message" role="status">{notice}</p>}

      <section>
        <h2>Pre-Sale events</h2>
        <form className="admin-form" onSubmit={(e) => submit(e, async (form) => {
          if (!idToken) return;
          await createPreSaleEvent(idToken, {
            name: text(form, 'name'),
            holidayTag: text(form, 'holidayTag'),
            orderWindowStart: new Date(text(form, 'orderWindowStart')).toISOString(),
            orderWindowEnd: new Date(text(form, 'orderWindowEnd')).toISOString(),
            pickupDate: new Date(text(form, 'pickupDate')).toISOString(),
            depositPercent: Number(text(form, 'depositPercent')),
            isActive: check(form, 'isActive'),
          });
        }, 'Event created.')}>
          <h3>Create event</h3>
          <input name="name" aria-label="Event name" placeholder="Event name" required />
          <input name="holidayTag" aria-label="Holiday tag" placeholder="Holiday tag" required />
          <label>Order window starts<input name="orderWindowStart" type="datetime-local" required /></label>
          <label>Order window ends<input name="orderWindowEnd" type="datetime-local" required /></label>
          <label>Pickup date<input name="pickupDate" type="datetime-local" required /></label>
          <label>Deposit percentage<input name="depositPercent" type="number" min="1" max="100" defaultValue="50" required /></label>
          <label><input name="isActive" type="checkbox" /> Active</label>
          <button disabled={saving}>Create event</button>
        </form>
        <div className="admin-record-list">
          {events.map((event) => (
            <details key={event.id}>
              <summary>{event.name} · {event.isActive ? 'Active' : 'Inactive'}</summary>
              <form className="admin-form" onSubmit={(e) => submit(e, (form) => updateEvent(event, form), 'Event updated.')}>
                <input name="name" aria-label="Event name" defaultValue={event.name} required />
                <input name="holidayTag" aria-label="Holiday tag" defaultValue={event.holidayTag} required />
                <label>Order window starts<input name="orderWindowStart" type="datetime-local" defaultValue={dateInput(event.orderWindowStart)} required /></label>
                <label>Order window ends<input name="orderWindowEnd" type="datetime-local" defaultValue={dateInput(event.orderWindowEnd)} required /></label>
                <label>Pickup date<input name="pickupDate" type="datetime-local" defaultValue={dateInput(event.pickupDate)} required /></label>
                <label>Deposit percentage<input name="depositPercent" type="number" min="1" max="100" defaultValue={event.depositPercent} required /></label>
                <label><input name="isActive" type="checkbox" defaultChecked={event.isActive} /> Active</label>
                <button disabled={saving}>Save event</button>
              </form>
            </details>
          ))}
        </div>
      </section>

      <MenuManagement
        idToken={idToken}
        events={events}
        packaging={packaging}
        onChanged={refreshCatalog}
      />

      <section>
        <h2>Packaging</h2>
        <form className="admin-form" onSubmit={(e) => submit(e, async (form) => {
          if (!idToken) return;
          await createPackagingOption(idToken, {
            name: text(form, 'name'),
            price: cents(form.get('price')),
            type: packagingType(form),
            isActive: check(form, 'isActive'),
          });
        }, 'Packaging option created.')}>
          <h3>Create packaging option</h3>
          <input name="name" aria-label="Packaging name" placeholder="Name" required />
          <input name="price" aria-label="Price in dollars" type="number" min="0" step="0.01" placeholder="Price ($)" required />
          <select name="type" aria-label="Packaging type" defaultValue="box"><option value="box">Box</option><option value="addon">Add-on</option></select>
          <label><input name="isActive" type="checkbox" defaultChecked /> Active</label>
          <button disabled={saving}>Create option</button>
        </form>
        <div className="admin-record-list">
          {packaging.map((option) => (
            <details key={option.id}>
              <summary>{option.name} · ${dollars(option.price)} · {option.type} · {option.isActive ? 'Active' : 'Inactive'}</summary>
              <form className="admin-form" onSubmit={(e) => submit(e, (form) => updatePackage(option, form), 'Packaging option updated.')}>
                <input name="name" aria-label="Packaging name" defaultValue={option.name} required />
                <input name="price" aria-label="Price in dollars" type="number" min="0" step="0.01" defaultValue={dollars(option.price)} required />
                <select name="type" aria-label="Packaging type" defaultValue={option.type}><option value="box">Box</option><option value="addon">Add-on</option></select>
                <label><input name="isActive" type="checkbox" defaultChecked={option.isActive} /> Active</label>
                <button disabled={saving}>Save option</button>
              </form>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2>Newsletter campaigns</h2>
        <p>Email content is plain text inside the fixed logo/signature template. SMS is plain text; include URLs in the message when needed.</p>
        <form className="admin-form" onSubmit={createCampaign}>
          <h3>Create campaign draft</h3>
          <input name="title" aria-label="Campaign title" placeholder="Internal campaign title" maxLength={200} required />
          <input name="subject" aria-label="Email subject" placeholder="Email subject" maxLength={200} />
          <textarea name="bodyText" aria-label="Email message" placeholder="Email message (plain text)" maxLength={20000} />
          <textarea name="smsBody" aria-label="SMS message" placeholder="SMS message (plain text; optional URLs)" maxLength={1600} />
          <label><input name="sendEmail" type="checkbox" defaultChecked /> Email</label>
          <label><input name="sendSms" type="checkbox" /> SMS</label>
          <button disabled={saving}>Save draft</button>
        </form>
        <div className="admin-record-list">
          {campaigns.map((campaign) => (
            <details key={campaign.id}>
              <summary>{campaign.title} · {campaign.status} · {campaign.sendEmail ? 'Email ' : ''}{campaign.sendSms ? 'SMS' : ''}</summary>
              <p><strong>Subject:</strong> {campaign.subject}</p>
              <p className="campaign-preview">{campaign.bodyText}</p>
              {campaign.smsBody && <p className="campaign-preview"><strong>SMS:</strong> {campaign.smsBody}</p>}
              {(campaign.status === 'draft' || campaign.status === 'failed') && (
                <button type="button" disabled={saving} onClick={() => sendCampaign(campaign)}>
                  {campaign.status === 'failed' ? 'Retry campaign' : 'Send now'}
                </button>
              )}
              <button type="button" disabled={saving} onClick={() => refreshCampaignLogs(campaign.id)}>Refresh send log</button>
              {campaignLogs[campaign.id]?.map((log) => (
                <p key={log.id}>
                  {log.channel}: {log.status}{log.errorMessage ? ` — ${log.errorMessage}` : ''}
                </p>
              ))}
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2>Orders</h2>
        <div className="admin-order-list">
          {orders.map((order) => (
            <button className="admin-order-row" key={order.id} type="button" onClick={() => openOrder(order)}>
              <span>#{order.orderNumber}</span><span>{order.type}</span><span>{order.status}</span>
              <span>{new Date(order.pickupDate).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
        {selectedOrder && (
          <article className="admin-order-detail">
            <h3>Order #{selectedOrder.order.orderNumber}</h3>
            <p>Status: {selectedOrder.order.status}</p>
            <p>Pickup: {new Date(selectedOrder.order.pickupDate).toLocaleString()}</p>
            <p>
              Contact: {selectedOrder.customer
                ? `${selectedOrder.customer.firstName} ${selectedOrder.customer.lastName} · ${selectedOrder.customer.email} · ${selectedOrder.customer.phone}`
                : `${selectedOrder.order.guestEmail ?? 'Guest'} · ${selectedOrder.order.guestPhone ?? 'No phone on record'}`}
            </p>
            <p>
              Items: {selectedOrder.items.map((item) =>
                `${item.quantity} × ${item.itemName ?? item.cookieDesignId ?? 'Cookie'}${item.variantLabel ? ` (${item.variantLabel})` : ''}`,
              ).join(', ')}
            </p>
            <ul>
              {selectedOrder.statusHistory.map((entry) => (
                <li key={entry.id}>{entry.status} — {new Date(entry.changedAt).toLocaleString()}{entry.note ? `: ${entry.note}` : ''}</li>
              ))}
            </ul>
            <form className="admin-form" onSubmit={(e) => submit(e, saveOrderStatus, 'Order status updated.')}>
              <select name="status" aria-label="New order status" defaultValue={selectedOrder.order.status}>
                {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
              </select>
              <input name="note" aria-label="Status note" maxLength={500} placeholder="Optional note" />
              <button disabled={saving}>Update status</button>
            </form>
          </article>
        )}
      </section>
    </main>
  );
}
