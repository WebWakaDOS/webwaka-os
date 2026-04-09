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
 *   POST /identity/verify-bvn             — BVN verification (auth required, M7a)
 *   POST /identity/verify-nin             — NIN verification (auth required, M7a)
 *   POST /identity/verify-cac             — CAC lookup (auth required, M7a)
 *   POST /identity/verify-frsc            — FRSC lookup (auth required, M7a)
 *   GET  /contact/channels                — get contact channels (auth required, M7a)
 *   PUT  /contact/channels                — upsert contact channels (auth required, M7a)
 *   POST /contact/verify/:channel         — send OTP to channel (auth required, M7a)
 *   POST /contact/confirm/:channel        — confirm OTP for channel (auth required, M7a)
 *   DELETE /contact/channels/:channel     — remove channel (auth required, M7a)
 *   GET  /contact/preferences             — get OTP preferences (auth required, M7a)
 *   PUT  /contact/preferences             — update OTP preferences (auth required, M7a)
 *   POST /sync/apply                      — offline queue replay (auth required, M7b)
 *   POST /pos/terminals                   — register POS terminal (auth required, M7b)
 *   POST /pos/float/credit                — top up agent float (auth required, M7b)
 *   POST /pos/float/debit                 — deduct from float (auth required, M7b)
 *   GET  /pos/float/balance               — get current balance (auth required, M7b)
 *   GET  /pos/float/history               — paginated ledger (auth required, M7b)
 *   POST /pos/float/reverse               — reverse a ledger entry (auth required, M7b)
 *
 * Platform Invariants enforced:
 *   T3 — tenant_id on all DB queries (via auth middleware context)
 *   T4 — kobo integers enforced by repository layer
 *   T5 — entitlement checks in entity create routes
 *   T6 — geography-driven discovery via /geography routes
 *   P6  — offline queue replay via /sync/apply (M7b)
 *   P9  — all float amounts validated as integer kobo (M7b)
 *   P10 — NDPR consent required before identity lookups (M7a)
 *   P11 — server-wins conflict on /sync/apply (M7b)
 *   R5  — 2/hour BVN/NIN rate limit (M7a)
 *   R8  — SMS mandatory for transaction OTPs (M7a)
 *   R9  — channel-level OTP rate limits (M7a)
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
import { identityRoutes } from './routes/identity.js';
import { contactRoutes } from './routes/contact.js';
import { syncRoutes } from './routes/sync.js';
import { posRoutes } from './routes/pos.js';
import { communityRoutes } from './routes/community.js';
import { socialRoutes } from './routes/social.js';
import { identityRateLimit } from './middleware/rate-limit.js';
import { auditLogMiddleware } from './middleware/audit-log.js';
import { assertDMMasterKey } from '@webwaka/social';
import { airtimeRoutes } from './routes/airtime.js';
import { lowDataMiddleware } from './middleware/low-data.js';
import { verticalsRoutes } from './routes/verticals.js';
import { workspaceVerticalsRoutes } from './routes/workspace-verticals.js';
import { superagentRoutes } from './routes/superagent.js';

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use('*', secureHeaders());
// M7b advisory: CORS origin reads ALLOWED_ORIGINS from Worker env (not hardcoded wildcard).
// ALLOWED_ORIGINS is a comma-separated string set via CF Dashboard secret.
// Fallback: ['https://*.webwaka.com', 'http://localhost:5173'] for development.
app.use('*', async (c, next) => {
  const envOrigins = c.env?.ALLOWED_ORIGINS;
  const allowed: string[] = envOrigins
    ? envOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : ['https://*.webwaka.com', 'http://localhost:5173'];

  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
  })(c, next);
});
app.use('*', logger());
// M7e: Low-data mode — strips media_urls from JSON responses when X-Low-Data: 1 (P4/P6)
app.use('*', lowDataMiddleware);

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
// M7a: Identity verification routes — auth + rate limit (R5) + audit log
// ---------------------------------------------------------------------------

app.use('/identity/*', authMiddleware);
app.use('/identity/*', auditLogMiddleware);
app.use('/identity/verify-bvn', identityRateLimit);
app.use('/identity/verify-nin', identityRateLimit);
app.route('/identity', identityRoutes);

// ---------------------------------------------------------------------------
// M7a: Contact channel routes — auth required (R9/R10 enforced in route handler)
// ---------------------------------------------------------------------------

app.use('/contact/*', authMiddleware);
app.use('/contact/verify/*', auditLogMiddleware);
app.route('/contact', contactRoutes);

// ---------------------------------------------------------------------------
// M7b: Offline sync endpoint — auth required (P11 — server-wins conflict)
// ---------------------------------------------------------------------------

app.use('/sync/*', authMiddleware);
app.route('/sync', syncRoutes);

// ---------------------------------------------------------------------------
// M7b: POS terminal + float ledger routes — auth required (P9/T3/T4)
// ---------------------------------------------------------------------------

app.use('/pos/*', authMiddleware);
app.route('/pos', posRoutes);

// ---------------------------------------------------------------------------
// M7c: Community routes — join requires auth (P10 NDPR), reads are public (T3)
// ---------------------------------------------------------------------------

app.use('/community/join', authMiddleware);
app.use('/community/channels/*/posts', authMiddleware);
app.use('/community/lessons/*/progress', authMiddleware);
app.use('/community/events/*/rsvp', authMiddleware);
app.route('/community', communityRoutes);

// ---------------------------------------------------------------------------
// M7e: Airtime top-up routes — auth required (P2/P9/T3/T4, KYC Tier 1, rate limit)
// ---------------------------------------------------------------------------

app.use('/airtime/*', authMiddleware);
app.route('/airtime', airtimeRoutes);

// ---------------------------------------------------------------------------
// M8a: Verticals registry routes — public (no auth required)
// ---------------------------------------------------------------------------

app.route('/verticals', verticalsRoutes);

// ---------------------------------------------------------------------------
// M8a: Workspace verticals activation — auth required
// ---------------------------------------------------------------------------

app.use('/workspaces/*/verticals*', authMiddleware);
app.route('/workspaces', workspaceVerticalsRoutes);

// ---------------------------------------------------------------------------
// SA-2.x: SuperAgent routes — auth required; /chat also runs aiConsentGate (P10/P12)
// ---------------------------------------------------------------------------

app.use('/superagent/*', authMiddleware);
app.route('/superagent', superagentRoutes);

// ---------------------------------------------------------------------------
// M7c: Social routes — most require auth; /social/profile/:handle is public
// P14 — assert DM_MASTER_KEY is present at startup before routes are wired.
// ---------------------------------------------------------------------------

app.use('/social/*', async (c, next) => {
  if (c.req.path.includes('/dm/threads')) {
    assertDMMasterKey(c.env.DM_MASTER_KEY);
  }
  await next();
});
app.use('/social/profile/setup', authMiddleware);
app.use('/social/follow/*', authMiddleware);
app.use('/social/feed', authMiddleware);
app.use('/social/posts', authMiddleware);
app.use('/social/posts/*/react', authMiddleware);
app.use('/social/dm/*', authMiddleware);
app.use('/social/stories', authMiddleware);
app.route('/social', socialRoutes);

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
