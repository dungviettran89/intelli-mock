import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    exclude: [
      'node_modules',
      'dist',
      'test/integration/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@intelli-mock/core': path.resolve(__dirname, './src'),
      // Allow test files to import src with relative paths
      '@src': path.resolve(__dirname, './src'),
    },
  },
});
