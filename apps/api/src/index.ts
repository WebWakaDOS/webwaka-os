/**
 * WebWaka API — Cloudflare Workers entry point.
 * Framework: Hono (https://hono.dev)
 *
 * Route map:
 *   GET  /health                           — liveness probe (no auth)
 *   POST /auth/login                       — issue JWT
 *   POST /auth/verify                      — validate a JWT, return decoded payload
 *   POST /auth/refresh                     — refresh JWT (auth required)
 *   GET  /auth/me                          — return caller's AuthContext (auth required)
 *   GET  /geography/places/:id             — place node (no auth)
 *   GET  /geography/places/:id/children    — direct children (no auth)
 *   GET  /geography/places/:id/ancestry    — ancestry breadcrumb (no auth)
 *   GET  /entities/individuals             — list (auth required)
 *   POST /entities/individuals             — create (auth + entitlement required)
 *   GET  /entities/individuals/:id         — get by ID (auth required)
 *   GET  /entities/organizations           — list (auth required)
 *   POST /entities/organizations           — create (auth + entitlement required)
 *   GET  /entities/organizations/:id       — get by ID (auth required)
 *   GET  /discovery/search                 — full-text + geography search (no auth)
 *   GET  /discovery/profiles/:type/:id     — public profile (no auth)
 *   POST /discovery/claim-intent           — capture claim interest (no auth)
 *   GET  /discovery/nearby/:placeId        — entities in subtree (no auth)
 *   GET  /discovery/trending               — most-viewed this week (no auth)
 *   POST /claim/intent                     — formal claim request (auth required)
 *   POST /claim/advance                    — advance claim state (admin only)
 *   POST /claim/verify                     — submit verification evidence (auth required)
 *   GET  /claim/status/:profileId          — public claim status (no auth)
 *   POST /workspaces/:id/activate          — activate workspace plan (auth required)
 *   PATCH /workspaces/:id                  — update plan/layers (admin only)
 *   POST /workspaces/:id/invite            — invite member (auth required)
 *   GET  /workspaces/:id/analytics         — usage metrics (auth required)
 *   POST /workspaces/:id/upgrade           — initialise Paystack checkout (auth required, M6)
 *   GET  /workspaces/:id/billing           — billing history (auth required, M6)
 *   POST /payments/verify                  — verify + sync Paystack payment (auth required, M6)
 *   GET  /public/:tenantSlug               — tenant manifest + discovery page (no auth, M6)
 *   GET  /admin/:workspaceId/dashboard     — admin layout model (no auth, M6)
 *   POST /themes/:tenantId                 — update tenant branding (auth required, M6)
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
import { discoveryRoutes } from './routes/discovery.js';
import { claimRoutes } from './routes/claim.js';
import { workspaceRoutes } from './routes/workspaces.js';
import {
  workspaceUpgradeRoute,
  workspaceBillingRoute,
  paymentsVerifyRoute,
} from './routes/payments.js';
import { publicRoutes, adminPublicRoutes, themeRoutes } from './routes/public.js';

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
app.route('/discovery', discoveryRoutes);

// ---------------------------------------------------------------------------
// Auth routes — /auth/login and /auth/verify are public;
// /auth/refresh and /auth/me require a valid JWT
// ---------------------------------------------------------------------------

app.use('/auth/refresh', authMiddleware);
app.use('/auth/me', authMiddleware);
app.route('/auth', authRoutes);

// ---------------------------------------------------------------------------
// Authenticated entity routes
// ---------------------------------------------------------------------------

app.use('/entities/*', authMiddleware);
app.route('/entities', entityRoutes);

// ---------------------------------------------------------------------------
// Claim routes — /claim/status/:profileId is public; others require auth
// ---------------------------------------------------------------------------

app.use('/claim/intent', authMiddleware);
app.use('/claim/advance', authMiddleware);
app.use('/claim/verify', authMiddleware);
app.route('/claim', claimRoutes);

// ---------------------------------------------------------------------------
// Workspace routes — all require auth
// ---------------------------------------------------------------------------

app.use('/workspaces/*', authMiddleware);
app.route('/workspaces', workspaceRoutes);
app.route('/workspaces', workspaceUpgradeRoute);
app.route('/workspaces', workspaceBillingRoute);

// ---------------------------------------------------------------------------
// M6: Payment verification route — auth required
// ---------------------------------------------------------------------------

app.use('/payments/*', authMiddleware);
app.route('/payments', paymentsVerifyRoute);

// ---------------------------------------------------------------------------
// M6: Public tenant + admin dashboard routes — no auth required
// ---------------------------------------------------------------------------

app.route('/public', publicRoutes);
app.route('/admin', adminPublicRoutes);

// ---------------------------------------------------------------------------
// M6: Theme routes — auth required
// ---------------------------------------------------------------------------

app.use('/themes/*', authMiddleware);
app.route('/themes', themeRoutes);

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
