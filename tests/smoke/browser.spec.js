const { test: base, expect } = require('@playwright/test');

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const blockedWrites = [];
    // These deployed-environment tests must never submit forms or mutate remote state.
    await page.route('**/*', (route) => {
      const method = route.request().method();
      if (testInfo.project.metadata.fixtureCatalog && method === 'GET' &&
          route.request().url() === new URL('/catalog/presale/events', process.env.SMOKE_API_URL).href) {
        return route.fulfill({ json: [] });
      }
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return route.continue();
      blockedWrites.push(`${method} ${new URL(route.request().url()).origin}`);
      return route.abort('blockedbyclient');
    });
    await use(page);
    expect(blockedWrites, 'Read-only smoke tests attempted remote writes').toEqual([]);
  },
});

test('home renders and navigation reaches the contact form', async ({ page, isMobile }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Welcome to Sugar Society Sugar Cookies', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('main').locator('form')).toBeVisible();
});

test('pre-sale page uses the configured API and renders its catalog', async ({ page }) => {
  const catalog = page.waitForResponse((response) =>
    response.url() === new URL('/catalog/presale/events', process.env.SMOKE_API_URL).href);
  await page.goto('/pre-sale', { waitUntil: 'domcontentloaded' });
  const response = await catalog;
  expect(response.status()).toBe(200);
  const events = await response.json();
  await expect(page.getByRole('heading', { name: 'Pre-Sales', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  if (events.length === 0) {
    await expect(page.getByRole('heading', { name: 'No Pre-Sales Are Available Right Now' })).toBeVisible();
  } else {
    for (const event of events) await expect(page.getByRole('heading', { name: event.name, exact: true })).toBeVisible();
  }
});

test('deep links work and anonymous admin access redirects to login', async ({ page }) => {
  const privacy = await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
  expect(privacy.status()).toBe(200);
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText(/privacy/i);
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Log In', exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Email', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Password', { exact: true })).toBeVisible();
});
