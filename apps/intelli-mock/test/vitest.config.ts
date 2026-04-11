import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
    ],
    testTimeout: 30000, // 30 seconds for CLI startup
    hookTimeout: 10000,
    // No coverage thresholds for E2E tests
  },
});
