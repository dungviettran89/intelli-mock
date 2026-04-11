import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/intelli-mock-core/vitest.config.ts',
  'apps/intelli-mock/test/vitest.config.ts',
]);
