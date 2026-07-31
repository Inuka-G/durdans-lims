import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// E9 — unit/component tests run under jsdom. tsconfigPaths resolves the `@/*` alias the
// app uses everywhere. The `.mts` extension forces ESM loading (vite-tsconfig-paths is
// ESM-only). Playwright specs under e2e/ are excluded so vitest never runs them.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
});
