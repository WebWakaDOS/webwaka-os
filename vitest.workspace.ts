import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/types/vitest.config.ts',
  'packages/core/geography/vitest.config.ts',
  'packages/core/politics/vitest.config.ts',
  'packages/auth/vitest.config.ts',
]);
