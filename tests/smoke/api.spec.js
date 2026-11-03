const { test, expect } = require('@playwright/test');

const api = process.env.SMOKE_API_URL;
const get = (request, path) => request.get(new URL(path, api).href, { timeout: 30_000, maxRedirects: 0 });

test('health confirms a real database query succeeds', async ({ request }) => {
  const response = await get(request, '/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', dbConnected: true });
});

test('public catalog returns events with valid identifiers and detail reads', async ({ request }) => {
  const response = await get(request, '/catalog/presale/events');
  expect(response.status()).toBe(200);
  const events = await response.json();
  expect(Array.isArray(events)).toBe(true);
  for (const event of events) {
    expect(event.id).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
    expect(typeof event.name).toBe('string');
    expect(['open', 'upcoming']).toContain(event.status);
  }
  // Empty catalogs are valid, but cannot establish checkout/menu readiness.
  test.info().annotations.push({ type: 'catalog', description: `${events.length} public events; no orders created` });
  if (events.length) {
    const detail = await get(request, `/catalog/presale/events/${events[0].id}`);
    expect(detail.status()).toBe(200);
    expect((await detail.json()).event.id).toBe(events[0].id);
  }
});

test('invalid catalog identifier is rejected without a database error', async ({ request }) => {
  const response = await get(request, '/catalog/presale/events/not-a-uuid');
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: 'Pre-Sale event not found' });
});

test('anonymous users cannot read admin catalog', async ({ request }) => {
  const response = await get(request, '/catalog/admin/presale-events');
  expect(response.status()).toBe(401);
});
