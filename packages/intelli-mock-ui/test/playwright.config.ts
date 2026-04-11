import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './global-setup.ts',
  fullyParallel: false,           // Tests share a single server instance
  forbidOnly: !!process.env.CI,   // Fail CI if .only is present
  retries: process.env.CI ? 2 : 0,
  workers: 1,                      // Single worker (shared server)
  reporter: [
    ['list'],
    ['html', { open: 'never' }],  // Generate report, don't auto-open
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Note: Vite dev server must be started manually before running tests
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: true,
  //   timeout: 30_000,
  // },
});
