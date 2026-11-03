const { defineConfig, devices } = require('@playwright/test');

for (const name of ['SMOKE_WEB_URL', 'SMOKE_API_URL']) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; smoke tests must target an explicit environment`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query or fragment`);
  }
}

module.exports = defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 45_000,
  globalTimeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.SMOKE_WEB_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false,
  },
  projects: [
    { name: 'api', testMatch: 'api.spec.js' },
    { name: 'desktop', testMatch: 'browser.spec.js', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: 'browser.spec.js', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
