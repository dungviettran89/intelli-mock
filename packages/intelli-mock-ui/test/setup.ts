import { test as base, expect } from '@playwright/test';

type TestFixtures = {
  // Reserved for future use
};

export const test = base.extend<TestFixtures>({
  // Before each test, navigate to the app
  page: async ({ page }, use) => {
    await page.goto('/');
    await use(page);
  },
});

export { expect };
