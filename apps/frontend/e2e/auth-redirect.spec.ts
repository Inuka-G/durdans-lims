import { test, expect } from '@playwright/test';

// Smoke e2e: an unauthenticated visit to a protected route must be redirected to /login
// by middleware.ts (which gates on the kc_session cookie). Deliberately hermetic — it
// exercises the redirect without a Keycloak round-trip.
test('unauthenticated access to a protected route redirects to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('security headers are present on the login page', async ({ page }) => {
  const response = await page.goto('/login');
  const headers = response?.headers() ?? {};
  // next.config sets these; assert the clickjacking guard at minimum.
  expect(headers['x-frame-options'] ?? headers['X-Frame-Options']).toBeTruthy();
});
