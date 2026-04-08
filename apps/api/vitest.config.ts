import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@webwaka/types':         path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@webwaka/auth':          path.resolve(__dirname, '../../packages/auth/src/index.ts'),
      '@webwaka/geography':     path.resolve(__dirname, '../../packages/core/geography/src/index.ts'),
      '@webwaka/entities':      path.resolve(__dirname, '../../packages/entities/src/index.ts'),
      '@webwaka/entitlements':  path.resolve(__dirname, '../../packages/entitlements/src/index.ts'),
      '@webwaka/relationships': path.resolve(__dirname, '../../packages/relationships/src/index.ts'),
      '@webwaka/claims':        path.resolve(__dirname, '../../packages/claims/src/index.ts'),
      '@webwaka/payments':      path.resolve(__dirname, '../../packages/payments/src/index.ts'),
      '@webwaka/events':        path.resolve(__dirname, '../../packages/events/src/index.ts'),
      '@webwaka/frontend':      path.resolve(__dirname, '../../packages/frontend/src/index.ts'),
      '@webwaka/identity':      path.resolve(__dirname, '../../packages/identity/src/index.ts'),
      '@webwaka/otp':           path.resolve(__dirname, '../../packages/otp/src/index.ts'),
      '@webwaka/contact':       path.resolve(__dirname, '../../packages/contact/src/index.ts'),
      '@webwaka/pos':           path.resolve(__dirname, '../../packages/pos/src/index.ts'),
      '@webwaka/community':     path.resolve(__dirname, '../../packages/community/src/index.ts'),
      '@webwaka/social':        path.resolve(__dirname, '../../packages/social/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
