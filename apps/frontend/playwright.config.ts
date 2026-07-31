import { defineConfig, devices } from '@playwright/test';

// E9 — Playwright e2e. The smoke spec targets the unauthenticated middleware redirect,
// so it needs no Keycloak round-trip. Run with: pnpm e2e
// (first-time only: pnpm exec playwright install chromium).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
