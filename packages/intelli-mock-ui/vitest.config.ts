import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@src': '/src',
      '@': '/src',
    },
  },
});
