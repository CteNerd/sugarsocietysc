import {
  CreateNewsletterCampaignRequest,
  NewsletterCampaign,
  NewsletterSendLog,
  NewsletterSubscriber,
} from '@sugarsocietysc/shared';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

export interface SubscribeInput {
  email: string;
  phone?: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
  source: string;
}

export interface PreferencesInput {
  emailOptIn: boolean;
  smsOptIn: boolean;
}

async function parseJson(res: Response) {
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new Error(body?.error ? JSON.stringify(body.error) : `Request failed (${res.status})`);
  }
  return body;
}

export async function subscribe(input: SubscribeInput): Promise<NewsletterSubscriber> {
  const res = await fetch(`${API_BASE_URL}/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function unsubscribe(token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/newsletter/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  await parseJson(res);
}

export async function updatePreferences(idToken: string, input: PreferencesInput): Promise<NewsletterSubscriber> {
  const res = await fetch(`${API_BASE_URL}/newsletter/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function listNewsletterCampaigns(idToken: string): Promise<NewsletterCampaign[]> {
  const res = await fetch(`${API_BASE_URL}/newsletter/admin/campaigns`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseJson(res);
}

export async function createNewsletterCampaign(
  idToken: string,
  input: CreateNewsletterCampaignRequest,
): Promise<NewsletterCampaign> {
  const res = await fetch(`${API_BASE_URL}/newsletter/admin/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function sendNewsletterCampaign(idToken: string, campaignId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/newsletter/admin/campaigns/${campaignId}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  await parseJson(res);
}

export async function getNewsletterCampaignLogs(idToken: string, campaignId: string): Promise<NewsletterSendLog[]> {
  const res = await fetch(`${API_BASE_URL}/newsletter/admin/campaigns/${campaignId}/logs`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseJson(res);
}
