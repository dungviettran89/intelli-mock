# Playwright E2E Tests

This directory contains Playwright E2E tests for the Intelli-Mock Web UI.

## Overview

These tests validate the UI components in a real browser, testing:
- Component rendering
- User interactions
- API integration
- End-to-end workflows

## Prerequisites

Before running the E2E tests, you need:

1. **Playwright installed:**
   ```bash
   pnpm --filter @intelli-mock/ui exec playwright install chromium
   ```

2. **Backend server running with auth disabled:**
   ```bash
   # Terminal 1: Start backend server
   cd apps/intelli-mock
   AUTH_DISABLED=true DB_TYPE=sqljs node dist/cli.js start --no-auth
   ```

3. **Vite dev server running:**
   ```bash
   # Terminal 2: Start Vite dev server
   pnpm --filter @intelli-mock/ui dev
   ```

## Running Tests

### Run all E2E tests:
```bash
pnpm --filter @intelli-mock/ui test:e2e
```

### Run tests with UI (interactive debugging):
```bash
pnpm --filter @intelli-mock/ui test:e2e:ui
```

### Run tests in debug mode:
```bash
pnpm --filter @intelli-mock/ui test:e2e:debug
```

### Run from root:
```bash
pnpm test:e2e
```

## Test Structure

```
test/
├── e2e/                          # E2E test files
│   └── mock-list.spec.ts         # Mock list component tests
├── helpers/
│   ├── seed.ts                   # Database seeding utilities
│   └── test-server.ts            # Test server setup
├── playwright.config.ts           # Playwright configuration
├── global-setup.ts                # Runs once before all tests
└── setup.ts                       # Test fixtures and hooks
```

## Current Tests

### Mock List Component (`mock-list.spec.ts`)
1. **Component rendering** - Validates the mock-list element is attached
2. **API integration** - Validates the component calls the API
3. **Data display** - Validates created mocks are displayed

## Known Issues

### Shadow DOM Text Visibility

Playwright's `getByText()` and `getByRole()` sometimes have difficulty seeing text inside Lit Element's shadow DOM. The tests currently work around this by:
- Using `page.evaluate()` to check shadow DOM content
- Waiting for network responses before assertions
- Using CSS selectors that pierce shadow DOM

### Server Startup

The tests currently require manual server startup (both backend and Vite dev server). Future improvement: automate this in Playwright's `webServer` config.

## Adding New Tests

1. Create a new `.spec.ts` file in `test/e2e/`
2. Import from `../setup.js` for test fixtures
3. Use `page.goto('/')` to navigate to the app
4. Use Playwright selectors to interact with the UI

Example:
```typescript
import { test, expect } from '../setup.js';

test.describe('My Component', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    // Your test logic here
  });
});
```

## Troubleshooting

### Tests fail with "page.goto('/') timeout"
- Make sure the Vite dev server is running on port 5173
- Check that the backend server is running on port 3000

### Tests fail with API errors
- Ensure the backend server has `AUTH_DISABLED=true`
- Check that both servers are using compatible configurations

### Shadow DOM assertions fail
- Use `page.evaluate()` to access shadow DOM directly
- Wait for network responses before checking rendered content
- Use CSS selectors instead of text-based selectors when needed

## Future Improvements

- [ ] Automate server startup in Playwright config
- [ ] Add tests for mock detail view
- [ ] Add tests for script editor (when implemented)
- [ ] Add tests for sample management
- [ ] Add visual regression tests
- [ ] Add cross-browser testing (Firefox, WebKit)
