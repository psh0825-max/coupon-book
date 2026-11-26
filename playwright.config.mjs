import { defineConfig, devices } from '@playwright/test';

export const PORT = 7810;
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 414, height: 896 }, // mobile-ish, matches PWA layout
    // The specs assert Korean copy; the app follows navigator.language.
    locale: 'ko-KR',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'ko-KR' } },
  ],
});
