/**
 * WebWaka API — Cloudflare Workers entry point.
 * Framework: Hono (https://hono.dev)
 *
 * Route map:
 *   GET  /health               — liveness probe (no auth)
 *   POST /auth/login           — issue JWT
 *   POST /auth/refresh         — refresh JWT (auth required)
 *   GET  /geography/:id        — place node (no auth)
 *   GET  /geography/:id/children — children (no auth)
 *   GET  /entities/individuals  — list (auth required)
 *   POST /entities/individuals  — create (auth + entitlement required)
 *   GET  /entities/individuals/:id  — get by ID (auth required)
 *   GET  /entities/organizations    — list (auth required)
 *   POST /entities/organizations    — create (auth + entitlement required)
 *   GET  /entities/organizations/:id — get by ID (auth required)
 *
 * Platform Invariants enforced:
 *   T3 — tenant_id on all DB queries (via auth middleware context)
 *   T4 — kobo integers enforced by repository layer
 *   T5 — entitlement checks in entity create routes
 *   T6 — geography-driven discovery via /geography routes
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './env.js';
import { authMiddleware } from './middleware/auth.js';
import { healthRoutes } from './routes/health.js';
import { geographyRoutes } from './routes/geography.js';
import { entityRoutes } from './routes/entities.js';
import { authRoutes } from './routes/auth-routes.js';

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use('*', secureHeaders());
app.use('*', cors({
  origin: ['https://*.webwaka.com', 'http://localhost:5173'],
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));
app.use('*', logger());

// ---------------------------------------------------------------------------
// Public routes (no auth)
// ---------------------------------------------------------------------------

app.route('/health', healthRoutes);
app.route('/geography', geographyRoutes);

// ---------------------------------------------------------------------------
// Authenticated routes
// ---------------------------------------------------------------------------

// /auth/login is public; /auth/refresh requires a valid JWT
app.use('/auth/refresh', authMiddleware);
app.route('/auth', authRoutes);

app.use('/entities/*', authMiddleware);
app.route('/entities', entityRoutes);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error('[webwaka-api] Unhandled error:', err);
  return c.json(
    {
      error: 'Internal server error',
      message: c.env?.ENVIRONMENT === 'development' ? err.message : undefined,
    },
    500,
  );
});

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------

app.notFound((c) => {
  return c.json({ error: `Route not found: ${c.req.method} ${c.req.path}` }, 404);
});

// Cloudflare Workers entry point
export default app;
