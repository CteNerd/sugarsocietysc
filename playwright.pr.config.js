const { defineConfig, devices } = require('@playwright/test');

process.env.SMOKE_API_URL = 'http://127.0.0.1:4174';

module.exports = defineConfig({
  testDir: './tests/smoke',
  testMatch: 'browser.spec.js',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 45_000,
  globalTimeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-browser-build.cjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop-pr', metadata: { fixtureCatalog: true }, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-pr', metadata: { fixtureCatalog: true }, use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
