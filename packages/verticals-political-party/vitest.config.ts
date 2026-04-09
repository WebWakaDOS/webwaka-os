import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@webwaka/types':     path.resolve(__dirname, '../types/src/index.ts'),
      '@webwaka/verticals': path.resolve(__dirname, '../verticals/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
