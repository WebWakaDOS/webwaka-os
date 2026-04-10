/**
 * GET /health         — liveness probe.
 * GET /health/version — version endpoint for smoke tests.
 * No authentication required.
 */

import { Hono } from 'hono';
import type { Env } from '../env.js';

// Keep in sync with apps/api/package.json version field.
// TEST-001: version endpoint required by smoke test suite.
const API_VERSION = '1.0.0';

const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'webwaka-api',
    environment: c.env.ENVIRONMENT ?? 'development',
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get('/version', (c) => c.json({ version: API_VERSION }));

export { healthRoutes };
