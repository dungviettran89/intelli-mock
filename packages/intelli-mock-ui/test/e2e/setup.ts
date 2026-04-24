import { test as base, expect } from '@playwright/test';

/**
 * Custom test fixture that automatically navigates to the base URL
 * and provides common E2E helpers.
 */
export const test = base.extend({
  // Add any custom fixtures here if needed
});

// Automatically navigate to base URL before each test
test.beforeEach(async ({ page }) => {
  // Increase timeout for slow dev server
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });
});

export { expect };
