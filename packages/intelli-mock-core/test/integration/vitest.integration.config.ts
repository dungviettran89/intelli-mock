import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/scenarios/**/*.test.ts'],
    testTimeout: 120000, // 120s for AI generation
    hookTimeout: 60000, // 60s for Ollama health check
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      '@intelli-mock/core': path.resolve(__dirname, '../../src'),
      '@src': path.resolve(__dirname, '../../src'),
    },
  },
});
