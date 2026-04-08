import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@webwaka/types': path.resolve(__dirname, '../types/src/index.ts'),
      '@webwaka/auth':  path.resolve(__dirname, '../auth/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
