# WebWaka OS — Production Remediation Plan
**Date:** 2026-04-10
**Based on:** Superagent Audit Report 2026-04-10 (HEAD `9bd9c36f63`)
**Target:** First successful `wrangler deploy --env staging` → verified smoke tests → production deploy
**Deployment Readiness Score at audit:** 47 / 100
**Target after this plan:** 100 / 100

---

## Overview

Tasks are ordered by dependency. A task that says **"unblocks"** must complete before any task it unblocks can run.

| Phase | Focus | Tasks | Unblocks |
|---|---|---|---|
| **Phase 1 — Cloudflare Wiring** | Create missing KV namespaces; wire all real IDs into `wrangler.toml` files; fix D1 naming | DEPLOY-001 → DEPLOY-004 | Everything. Nothing can deploy without this. |
| **Phase 2 — Migrations** | Apply all 186 migrations to remote D1 staging, then production | DEPLOY-005 | Routes that query negotiation, search, discovery, ministry |
| **Phase 3 — Security Fixes** | Fix tenant impersonation in social/community, P9 float columns, NDPR erasure, rate-limit headers | SEC-001 → SEC-005 | Compliance sign-off; CBN sandbox application |
| **Phase 4 — Smoke Tests** | Wire smoke test package.json, add `/version` endpoint, fix `SMOKE_API_KEY` guard | TEST-001 → TEST-003 | CI green on staging deploy |
| **Phase 5 — CI Hardening** | Production approval gate, `Retry-After` header, USSD compat date, pnpm audit dependency | OPS-001 → OPS-004 | Production deploy safety |

---

## Phase 1 — Cloudflare Wiring

> **Goal:** `wrangler deploy --env staging` exits 0. No placeholder IDs remain. All four Workers can start.

### DEPLOY-001 — Create missing KV namespaces on Cloudflare

**Severity:** BLOCKER
**Effort:** 10 minutes (manual Wrangler CLI)
**Unblocks:** DEPLOY-002, DEPLOY-003, DEPLOY-004

The following KV namespaces do not exist in the Cloudflare account and must be created before any `wrangler.toml` can be completed:

```bash
# Run from repo root (requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in env)
export CLOUDFLARE_API_TOKEN="mx5yewdNFpT7oGZxt81BdUKJ1UF3_tUaiVL0rrG_"
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

# Geography cache (apps/api)
npx wrangler kv namespace create "GEOGRAPHY_CACHE" --env staging
npx wrangler kv namespace create "GEOGRAPHY_CACHE" --env production

# Theme cache (apps/brand-runtime)
npx wrangler kv namespace create "THEME_CACHE" --env staging
npx wrangler kv namespace create "THEME_CACHE" --env production

# Discovery cache (apps/public-discovery)
npx wrangler kv namespace create "DISCOVERY_CACHE" --env staging
npx wrangler kv namespace create "DISCOVERY_CACHE" --env production

# USSD session state (apps/ussd-gateway)
npx wrangler kv namespace create "USSD_SESSION_KV" --env staging
npx wrangler kv namespace create "USSD_SESSION_KV" --env production
```

After running each command, Wrangler will print the new namespace ID. Copy each ID — you need them for DEPLOY-002 through DEPLOY-004.

**Already confirmed existing (use these directly):**
- `RATE_LIMIT_KV` staging: `608eacac3eb941a68c716b14e84b4d10`
- `RATE_LIMIT_KV` production: `af260e847d1e400e94cf13f6ae3214eb`

---

### DEPLOY-002 — Fix `apps/api/wrangler.toml`

**Severity:** BLOCKER
**Effort:** 5 minutes
**Unblocks:** staging API deploy

Replace the full file with the following (substitute `<GEOGRAPHY_CACHE_STAGING_ID>` etc. from the IDs produced by DEPLOY-001):

```toml
name = "webwaka-api"
main = "src/index.ts"
compatibility_date = "2024-12-05"
compatibility_flags = ["nodejs_compat"]

# Negotiation expiry CRON — runs every 15 minutes
[[triggers]]
crons = ["*/15 * * * *"]

[vars]
ENVIRONMENT = "development"

# ---------------------------------------------------------------------------
# Local development — uses wrangler --local (in-process D1 and KV)
# ---------------------------------------------------------------------------
[[d1_databases]]
binding = "DB"
database_name = "webwaka-main"
database_id = "local-dev-placeholder"

[[kv_namespaces]]
binding = "GEOGRAPHY_CACHE"
id = "local-dev-placeholder"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "local-dev-placeholder"

# ---------------------------------------------------------------------------
# Staging
# ---------------------------------------------------------------------------
[env.staging]
name = "webwaka-api-staging"

[env.staging.vars]
ENVIRONMENT = "staging"
APP_BASE_URL = "https://api-staging.webwaka.ng"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "webwaka-os-staging"
database_id = "cfa62668-bbd0-4cf2-996a-53da76bab948"

[[env.staging.kv_namespaces]]
binding = "GEOGRAPHY_CACHE"
id = "<GEOGRAPHY_CACHE_STAGING_ID>"

[[env.staging.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "608eacac3eb941a68c716b14e84b4d10"

# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------
[env.production]
name = "webwaka-api-production"

[env.production.vars]
ENVIRONMENT = "production"
APP_BASE_URL = "https://api.webwaka.ng"

[[env.production.d1_databases]]
binding = "DB"
database_name = "webwaka-os-production"
database_id = "de1d0935-31ed-4a33-a0fd-0122d7a4fe43"

[[env.production.kv_namespaces]]
binding = "GEOGRAPHY_CACHE"
id = "<GEOGRAPHY_CACHE_PRODUCTION_ID>"

[[env.production.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "af260e847d1e400e94cf13f6ae3214eb"
```

**Key changes from current file:**
1. `database_name` changed from `"webwaka-main"` → `"webwaka-os-staging"` / `"webwaka-os-production"` (matches actual CF D1 names)
2. `database_id` staging: was `"cfa62668"` (truncated) → full UUID `"cfa62668-bbd0-4cf2-996a-53da76bab948"`
3. `RATE_LIMIT_KV` IDs: were `"STAGING_RATE_LIMIT_KV_NAMESPACE_ID"` → real IDs
4. `GEOGRAPHY_CACHE` IDs: were placeholders → IDs from DEPLOY-001
5. Added `APP_BASE_URL` to staging and production vars (fixes Paystack callback URL in staging)

---

### DEPLOY-003 — Fix `apps/brand-runtime/wrangler.toml`

**Severity:** BLOCKER
**Effort:** 5 minutes
**Unblocks:** brand-runtime Worker deploy

Replace the full file:

```toml
# apps/brand-runtime/wrangler.toml
name = "webwaka-brand-runtime"
main = "src/index.ts"
compatibility_date = "2024-12-05"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"

[[d1_databases]]
binding = "DB"
database_name = "webwaka-main"
database_id = "local-dev-placeholder"

[[kv_namespaces]]
binding = "THEME_CACHE"
id = "local-dev-placeholder"

# ---------------------------------------------------------------------------
# Staging
# ---------------------------------------------------------------------------
[env.staging]
name = "webwaka-brand-runtime-staging"

[env.staging.vars]
ENVIRONMENT = "staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "webwaka-os-staging"
database_id = "cfa62668-bbd0-4cf2-996a-53da76bab948"

[[env.staging.kv_namespaces]]
binding = "THEME_CACHE"
id = "<THEME_CACHE_STAGING_ID>"

# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------
[env.production]
name = "webwaka-brand-runtime-production"

[env.production.vars]
ENVIRONMENT = "production"

[[env.production.d1_databases]]
binding = "DB"
database_name = "webwaka-os-production"
database_id = "de1d0935-31ed-4a33-a0fd-0122d7a4fe43"

[[env.production.kv_namespaces]]
binding = "THEME_CACHE"
id = "<THEME_CACHE_PRODUCTION_ID>"

# Secrets (set via: wrangler secret put SECRET_NAME)
# Required:
#   JWT_SECRET
#   LOG_PII_SALT
#   INTER_SERVICE_SECRET
```

---

### DEPLOY-004 — Fix `apps/public-discovery/wrangler.toml` and `apps/ussd-gateway/wrangler.toml`

**Severity:** BLOCKER
**Effort:** 5 minutes each
**Unblocks:** public-discovery and ussd-gateway deploys

**`apps/public-discovery/wrangler.toml`** — replace with:

```toml
# apps/public-discovery/wrangler.toml
name = "webwaka-public-discovery"
main = "src/index.ts"
compatibility_date = "2024-12-05"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"

[[d1_databases]]
binding = "DB"
database_name = "webwaka-main"
database_id = "local-dev-placeholder"

[[kv_namespaces]]
binding = "DISCOVERY_CACHE"
id = "local-dev-placeholder"

[env.staging]
name = "webwaka-public-discovery-staging"

[env.staging.vars]
ENVIRONMENT = "staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "webwaka-os-staging"
database_id = "cfa62668-bbd0-4cf2-996a-53da76bab948"

[[env.staging.kv_namespaces]]
binding = "DISCOVERY_CACHE"
id = "<DISCOVERY_CACHE_STAGING_ID>"

[env.production]
name = "webwaka-public-discovery-production"

[env.production.vars]
ENVIRONMENT = "production"

[[env.production.d1_databases]]
binding = "DB"
database_name = "webwaka-os-production"
database_id = "de1d0935-31ed-4a33-a0fd-0122d7a4fe43"

[[env.production.kv_namespaces]]
binding = "DISCOVERY_CACHE"
id = "<DISCOVERY_CACHE_PRODUCTION_ID>"

# Secrets: LOG_PII_SALT
```

**`apps/ussd-gateway/wrangler.toml`** — replace with:

```toml
# apps/ussd-gateway/wrangler.toml
name = "webwaka-ussd-gateway"
main = "src/index.ts"
compatibility_date = "2024-12-05"   # FIXED: was "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[env.staging]
name = "webwaka-ussd-gateway-staging"
vars = { ENVIRONMENT = "staging" }

[[env.staging.d1_databases]]
binding = "DB"
database_name = "webwaka-os-staging"
database_id = "cfa62668-bbd0-4cf2-996a-53da76bab948"

[[env.staging.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "608eacac3eb941a68c716b14e84b4d10"

[[env.staging.kv_namespaces]]
binding = "USSD_SESSION_KV"
id = "<USSD_SESSION_KV_STAGING_ID>"

[env.production]
name = "webwaka-ussd-gateway-production"
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "webwaka-os-production"
database_id = "de1d0935-31ed-4a33-a0fd-0122d7a4fe43"

[[env.production.kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "af260e847d1e400e94cf13f6ae3214eb"

[[env.production.kv_namespaces]]
binding = "USSD_SESSION_KV"
id = "<USSD_SESSION_KV_PRODUCTION_ID>"

[env.staging.routes]
pattern = "api-staging.webwaka.ng/ussd"
zone_name = "webwaka.ng"

[env.production.routes]
pattern = "api.webwaka.ng/ussd"
zone_name = "webwaka.ng"

# Secrets:
#   AFRICAS_TALKING_USERNAME
#   AFRICAS_TALKING_API_KEY
#   INTER_SERVICE_SECRET
#   JWT_SECRET
#   LOG_PII_SALT
```

---

## Phase 2 — Migrations

> **Goal:** All 186 migrations applied to staging D1. No "table not found" errors at runtime.

### DEPLOY-005 — Apply all pending migrations to remote D1

**Severity:** BLOCKER
**Effort:** 15 minutes
**Depends on:** DEPLOY-002 (correct `database_name` in `wrangler.toml`)
**Unblocks:** negotiation routes, search, discovery, ministry vertical

The CI workflow already runs `wrangler d1 migrations apply` — but it has never succeeded because `database_name` was wrong. After DEPLOY-002, the CI command will target the correct database. However, 8 specific migrations were flagged as never applied; run them manually first to verify:

```bash
export CLOUDFLARE_API_TOKEN="mx5yewdNFpT7oGZxt81BdUKJ1UF3_tUaiVL0rrG_"
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

# Apply ALL migrations to staging D1
npx wrangler d1 migrations apply webwaka-os-staging \
  --env staging \
  --migrations-dir infra/db/migrations \
  --remote

# Verify the 8 previously-missing tables exist
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN (
    'search_entries', 'discovery_events', 'vendor_pricing_policies',
    'listing_price_overrides', 'negotiation_sessions', 'negotiation_offers',
    'negotiation_audit_log', 'ministry_members'
  ) ORDER BY name;"
```

Expected: 8 rows returned, one for each table. If any are missing, apply the individual migration file:

```bash
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --file infra/db/migrations/0183_negotiation_sessions.sql
# repeat for each missing file
```

**Migration sequence gap (0038–0041):** Confirm whether these are intentionally absent or lost. Search git log:
```bash
git log --all --oneline --diff-filter=D -- 'infra/db/migrations/003[89]_*.sql' 'infra/db/migrations/004[01]_*.sql'
```
If the files were deleted, restore them from git history. If they were never created, add four no-op placeholder migrations:
```sql
-- 0038_placeholder.sql
-- Sequence placeholder (original migration was not required)
SELECT 1;
```

**Do not apply to production** until staging smoke tests pass (TEST-001 through TEST-003).

---

## Phase 3 — Security Fixes

> **Goal:** Zero CRITICAL findings. T3 invariant restored. P9 float columns fixed. NDPR compliant.

### SEC-001 — Fix tenant impersonation in `social.ts` and `community.ts` [CRITICAL]

**Severity:** CRITICAL
**Effort:** 20 minutes
**File:** `apps/api/src/routes/social.ts`, `apps/api/src/routes/community.ts`

**Root cause:** Both files define `getTenantId(c)` which reads `X-Tenant-Id` from the HTTP request header. Any authenticated caller can forge this header and cross tenant boundaries on every social and community endpoint.

**The fix has two parts:**

**Part A — Auth-required endpoints** (all endpoints that call `c.get('auth')`):
Replace `getTenantId(c)` with `c.get('auth').tenantId`. The auth middleware already validates the JWT and populates this from the verified `tenant_id` claim.

**Part B — Public endpoints with no auth** (`GET /social/profile/:handle`, `GET /community/channels/:id/posts`, `GET /community/lessons/:id`, `GET /community/:id/channels`, `GET /community/:id/courses`, `GET /community/:id/events`, `GET /community/:slug`):
These are legitimately public (no JWT required) so `X-Tenant-Id` from the header is the only option. Keep `getTenantId(c)` for these routes only.

**Exact diff for `apps/api/src/routes/social.ts`:**

```typescript
// BEFORE (all routes, lines 52–53):
function getTenantId(c: { req: { header(name: string): string | undefined } }): string | null {
  return c.req.header('X-Tenant-Id') ?? null;
}

// AFTER — keep for public routes only, add auth-aware helper:
function getTenantIdPublic(c: { req: { header(name: string): string | undefined } }): string | null {
  return c.req.header('X-Tenant-Id') ?? null;
}

// Then in each auth-required route, replace:
//   const tenantId = getTenantId(c);
// with:
//   const tenantId = c.get('auth').tenantId;
```

**Routes that must switch to `c.get('auth').tenantId` in `social.ts`:**
- `POST /social/profile/setup` (line 79)
- `POST /social/follow/:id` (line 121)
- `GET /social/feed` (line 147)
- `POST /social/posts` (line 164)
- `POST /social/posts/:id/react` (line 194)
- `GET /social/dm/threads` (line 224)
- `POST /social/dm/threads` (line 239)
- `POST /social/dm/threads/:id/messages` (line 272)
- `GET /social/stories` (line 304)

**Routes that must switch to `c.get('auth').tenantId` in `community.ts`:**
- `POST /community/channels/:id/posts` (line 77)
- `POST /community/lessons/:id/progress` (line 123)
- `POST /community/events/:id/rsvp` (line 148)
- `POST /community/join` (line 205)

**Verification after fix:**
```bash
# No auth-required route should call getTenantId()
grep -n "getTenantId" apps/api/src/routes/social.ts apps/api/src/routes/community.ts
# Should only appear in: GET /profile/:handle, GET /channels/:id/posts (public), GET /lessons/:id (public),
# GET /:id/channels, GET /:id/courses, GET /:id/events, GET /:slug
```

---

### SEC-002 — Fix P9 violation: `REAL` columns in bakery and cleaning-service migrations [CRITICAL]

**Severity:** CRITICAL
**Effort:** 30 minutes (2 new migrations + package updates)
**Files:** `infra/db/migrations/0058_vertical_bakery.sql`, `infra/db/migrations/0062_vertical_cleaning_service.sql`

**Create migration `0187_fix_p9_inventory_real_columns.sql`:**

```sql
-- Migration 0187 — Fix P9 violations: REAL inventory columns → INTEGER
-- P9: All measurable quantities must be INTEGER to prevent float arithmetic
-- in inventory valuation (quantity × unit_cost_kobo paths).
--
-- Convention: quantity stored as INTEGER milligrams (mg) for weight,
-- INTEGER millilitres (ml) for volume, INTEGER thousandths for piece/unitless.
-- Divide by 1000 in application layer to show grams/litres/units.

-- bakery_ingredients: rename REAL columns
ALTER TABLE bakery_ingredients RENAME COLUMN quantity_in_stock TO quantity_in_stock_x1000;
ALTER TABLE bakery_ingredients RENAME COLUMN reorder_level TO reorder_level_x1000;

-- Update existing rows: multiply by 1000 to convert from float to integer representation
-- (safe because existing REAL values are small and will not overflow INTEGER)
UPDATE bakery_ingredients SET
  quantity_in_stock_x1000 = CAST(quantity_in_stock_x1000 * 1000 AS INTEGER),
  reorder_level_x1000     = CAST(reorder_level_x1000 * 1000 AS INTEGER);

-- cleaning_supplies: rename REAL column
ALTER TABLE cleaning_supplies RENAME COLUMN quantity_in_stock TO quantity_in_stock_x1000;

UPDATE cleaning_supplies SET
  quantity_in_stock_x1000 = CAST(quantity_in_stock_x1000 * 1000 AS INTEGER);
```

**Update `packages/verticals-bakery/src/types.ts`** (and bakery.ts):
- Rename `quantityInStock: number` → `quantityInStockX1000: number` (INTEGER, divide by 1000 for display)
- Rename `reorderLevel: number` → `reorderLevelX1000: number`

**Update `packages/verticals-cleaning-service/src/types.ts`** (and cleaning-service.ts):
- Rename `quantityInStock: number` → `quantityInStockX1000: number`

---

### SEC-003 — Fix P9 violation: `confidence REAL` in `community_moderation_log` [CRITICAL]

**Severity:** CRITICAL
**Effort:** 20 minutes (1 new migration + package update)
**File:** `infra/db/migrations/0030_community_moderation.sql` line 16

**Create migration `0188_fix_p9_moderation_confidence.sql`:**

```sql
-- Migration 0188 — Fix P9 violation: confidence REAL → INTEGER basis points
-- confidence stored as INTEGER 0–10000 where 10000 = 100.00% confidence.
-- Existing values (0.0–1.0 float) multiplied by 10000 and cast to INTEGER.

ALTER TABLE community_moderation_log RENAME COLUMN confidence TO confidence_bps;

UPDATE community_moderation_log SET
  confidence_bps = CAST(confidence_bps * 10000 AS INTEGER);
```

**Update `packages/social/src/moderation.ts`** (or wherever confidence is written/read):
- Write: `confidence_bps = Math.round(confidenceFloat * 10000)`
- Read: `confidence: row.confidence_bps / 10000` (display only — never compute with the float)

---

### SEC-004 — Add NDPR data-erasure endpoint [HIGH — Compliance]

**Severity:** HIGH (compliance blocker for Nigerian users)
**Effort:** 45 minutes
**File:** `apps/api/src/routes/auth-routes.ts` (add to existing auth router)

**Add `DELETE /me` to `auth-routes.ts`:**

```typescript
// DELETE /me — NDPR Article 3.1(9) Right to Erasure
// Anonymises PII in users table. Does NOT delete the row (preserves FK integrity).
authRoutes.delete('/me', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB as unknown as D1Like;

  const anonymisedRef = `deleted_${crypto.randomUUID()}`;

  // Anonymise user PII
  await db.prepare(
    `UPDATE users SET
      email           = ?,
      full_name       = 'Deleted User',
      phone           = NULL,
      password_hash   = NULL,
      updated_at      = unixepoch()
    WHERE id = ? AND tenant_id = ?`
  ).bind(`${anonymisedRef}@deleted.invalid`, auth.userId, auth.tenantId).run();

  // Purge contact channels
  await db.prepare(
    `DELETE FROM contact_channels WHERE user_id = ? AND tenant_id = ?`
  ).bind(auth.userId, auth.tenantId).run();

  // Invalidate all sessions for this user (if sessions table exists)
  await db.prepare(
    `DELETE FROM sessions WHERE user_id = ?`
  ).bind(auth.userId).run();

  return c.json({ message: 'Your data has been erased in accordance with NDPR Article 3.1(9).' }, 200);
});
```

**Mount in `apps/api/src/index.ts`:**
Confirm `authRoutes` is already mounted at `/auth`. If `DELETE /me` conflicts with an existing route, mount at `/me` with a separate mini-router.

**Smoke test addition** (add to `tests/smoke/api-health.smoke.ts`):
```typescript
// Do NOT use a real user — just verify route exists (405 on no-auth is acceptable)
await check('DELETE /me route exists (NDPR erasure)', async () => {
  const r = await fetch(`${BASE_URL}/auth/me`, { method: 'DELETE' });
  expect([200, 401, 403].includes(r.status), `Expected 200/401/403, got ${r.status}`);
});
```

---

### SEC-005 — Add `Retry-After` HTTP header to rate-limit 429 responses [HIGH]

**Severity:** HIGH
**Effort:** 5 minutes
**File:** `apps/api/src/middleware/rate-limit.ts`

**Replace the 429 return block and add KV graceful degradation:**

```typescript
export function rateLimitMiddleware(opts: RateLimitOptions) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    // Use CF-Connecting-IP for global (pre-auth) limiting — not the spoofable X-User-Id header
    const subject = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const key = `rl:${opts.keyPrefix}:${subject}`;
    const kv = c.env.RATE_LIMIT_KV;

    let count = 0;
    try {
      const countStr = await kv.get(key);
      count = countStr ? parseInt(countStr, 10) : 0;
    } catch (kvErr) {
      // KV unavailable — fail open for availability (log the error)
      console.error('[rate-limit] KV read failed, failing open:', kvErr);
      await next();
      return;
    }

    if (count >= opts.maxRequests) {
      c.header('Retry-After', String(opts.windowSeconds));  // ← ADD THIS
      return c.json(
        {
          error: 'rate_limit_exceeded',
          message: `Too many requests. Maximum ${opts.maxRequests} per ${opts.windowSeconds / 60} minute(s).`,
          retry_after_seconds: opts.windowSeconds,
        },
        429,
      );
    }

    try {
      await kv.put(key, String(count + 1), { expirationTtl: opts.windowSeconds });
    } catch (kvErr) {
      // KV write failed — don't block the request
      console.error('[rate-limit] KV write failed:', kvErr);
    }

    await next();
  });
}
```

**Changes from current code:**
1. `Retry-After` HTTP header added to 429 response (RFC 6585 compliance; Prembly SDK compatibility)
2. `try/catch` around both `kv.get` and `kv.put` — KV unavailability no longer crashes the entire API
3. Rate-limit key uses `CF-Connecting-IP` instead of `X-User-Id` (prevents header-spoofed bypass)

---

## Phase 4 — Smoke Tests

> **Goal:** `pnpm --filter smoke run smoke:staging` exits 0 after every staging deploy.

### TEST-001 — Add `/version` endpoint to health routes [HIGH]

**Severity:** HIGH (smoke suite fails without it)
**Effort:** 10 minutes
**File:** `apps/api/src/routes/health.ts`

Replace the full file:

```typescript
/**
 * Health + version routes.
 * GET /health — liveness probe (no auth)
 * GET /version — semver string (no auth)
 */

import { Hono } from 'hono';
import type { Env } from '../env.js';

// version is injected at build time via wrangler --define or read from package.json
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev';

const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'webwaka-api',
    environment: c.env.ENVIRONMENT ?? 'development',
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get('/version', (c) => {
  return c.json({ version: VERSION });
});

export { healthRoutes };
```

Add to `apps/api/wrangler.toml` under `[vars]`:
```toml
[vars]
ENVIRONMENT = "development"
# VERSION is injected via define at build time — see package.json build script
```

Add to `apps/api/package.json` build script:
```json
"build": "wrangler deploy --dry-run --outdir dist --define __VERSION__:$(node -p \"require('./package.json').version\")"
```

Or simpler — if `__VERSION__` injection is complex, just hardcode from `package.json` via a build step:
```typescript
// health.ts simpler alternative
import pkg from '../../package.json' assert { type: 'json' };
healthRoutes.get('/version', (c) => c.json({ version: pkg.version }));
```

---

### TEST-002 — Add `tests/smoke/package.json` so CI actually runs smoke tests [LOW]

**Severity:** LOW (smoke tests silently skipped without this file)
**Effort:** 10 minutes

Create `tests/smoke/package.json`:

```json
{
  "name": "smoke",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "smoke:staging": "BASE_URL=$SMOKE_BASE_URL SMOKE_API_KEY=$SMOKE_API_KEY tsx api-health.smoke.ts",
    "smoke:production": "BASE_URL=$SMOKE_BASE_URL SMOKE_API_KEY=$SMOKE_API_KEY tsx api-health.smoke.ts"
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

Also add `tests/smoke` to the pnpm workspace in `pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tests/smoke'   # ← ADD
```

Add `STAGING_BASE_URL` and `PRODUCTION_BASE_URL` as GitHub Actions variables (not secrets — these are public URLs):
- `STAGING_BASE_URL` = `https://webwaka-api-staging.<your-cf-subdomain>.workers.dev`
- `PRODUCTION_BASE_URL` = `https://api.webwaka.ng`

---

### TEST-003 — Fix `SMOKE_API_KEY` silent fallback [MEDIUM]

**Severity:** MEDIUM
**Effort:** 5 minutes
**File:** `tests/smoke/api-health.smoke.ts` line 14

Replace:
```typescript
const API_KEY = process.env['SMOKE_API_KEY'] ?? 'smoke-key-not-set';
```
With:
```typescript
const API_KEY = process.env['SMOKE_API_KEY'];
if (!API_KEY) {
  console.error('[smoke] FATAL: SMOKE_API_KEY environment variable is not set.');
  process.exit(1);
}
```

---

## Phase 5 — CI Hardening

> **Goal:** Production deploys require human approval. CI audit gates run before production ship.

### OPS-001 — Add GitHub environment protection to production deploy [HIGH]

**Severity:** HIGH
**Effort:** 5 minutes (GitHub UI, not code)

In the GitHub repo:
1. Go to **Settings → Environments → production**
2. Enable **Required reviewers** → add yourself (and any co-leads)
3. Enable **Prevent self-review** if you want a second set of eyes

This gates `deploy-api-production` behind a manual approval click. A bad merge to `main` will queue the deploy but not auto-ship it.

No code change required — the `deploy-production.yml` already uses `environment: production`.

---

### OPS-002 — Make `deploy-api-production` depend on `audit` job completing first [LOW]

**Severity:** LOW
**Effort:** 5 minutes
**File:** `.github/workflows/deploy-production.yml`

Update the `deploy-api-production` job `needs` array:

```yaml
# BEFORE:
deploy-api-production:
  needs: migrate-production

# AFTER:
deploy-api-production:
  needs: [migrate-production, ci]  # ci already calls audit — this is a no-op safety net
```

The current `ci.yml` workflow (called via `uses: ./.github/workflows/ci.yml`) already includes `pnpm audit`. This change ensures the audit job must complete (not just start) before deploy proceeds.

---

### OPS-003 — Fix `billing_history.amount_naira` column name [MEDIUM]

**Severity:** MEDIUM (maintenance time bomb — confusing column name stores kobo)
**Effort:** 15 minutes (1 migration)

**Create migration `0189_fix_billing_amount_column_name.sql`:**

```sql
-- Migration 0189 — Rename billing_history.amount_naira → amount_kobo
-- Column stores kobo (INTEGER) but was named amount_naira — misleading.
-- All existing values are already kobo — no value transformation needed.

ALTER TABLE billing_history RENAME COLUMN amount_naira TO amount_kobo;
```

**Update `apps/api/src/routes/payments.ts`:**
- Find all references to `amount_naira` and rename to `amount_kobo`

**Update `packages/types/src/entities.ts`** (if `BillingHistory` type exists):
- Rename `amountNaira` → `amountKobo`

---

### OPS-004 — Fix negotiation CRON: expired session audit entries use `tenant_id: 'system'` [LOW]

**Severity:** LOW
**Effort:** 10 minutes
**File:** `apps/api/src/jobs/negotiation-expiry.ts` lines 27, 49

The CRON job writes `tenant_id: 'system'` to `negotiation_audit_log` for expired sessions. The expired session has a real `tenant_id` — use it.

**Diff:**
```typescript
// BEFORE (line 27 — expiry audit entry for sessions past expiry):
await repo.createAuditEntry({
  tenant_id: 'system',     // ← WRONG
  ...

// AFTER:
await repo.createAuditEntry({
  tenant_id: session.tenant_id,   // ← use the session's real tenant_id
  ...
```

Line 49 already correctly uses `session.tenant_id` for cancelled sessions. Line 27 (expiry case) does not — fix only line 27.

---

## Phase 6 — Deferred (Post-Launch)

These are real findings but do not block the first production deploy:

| ID | Finding | When |
|---|---|---|
| MED-02 | `places.tenant_id` nullable — add CHECK constraint | Before multi-tenant geography launch |
| HIGH-09 | `billing_history` missing `tenant_id` column | Before multi-workspace-per-tenant feature |
| LOW-01 | Add `CLOUDFLARE_ACCOUNT_ID` guard to CI | Before adding new CI contributors |
| MED-06 — already OPS-001 | Production environment approval gate | Done in OPS-001 above |

---

## Execution Order Summary

Copy this as a checklist. Work top-to-bottom. Do not skip phases.

```
Phase 1 — Cloudflare Wiring (est. 25 min)
[ ] DEPLOY-001  Create missing KV namespaces (CLI) — copy all IDs to notepad
[ ] DEPLOY-002  Fix apps/api/wrangler.toml — paste real KV + D1 IDs
[ ] DEPLOY-003  Fix apps/brand-runtime/wrangler.toml
[ ] DEPLOY-004  Fix apps/public-discovery/wrangler.toml + apps/ussd-gateway/wrangler.toml
[ ] COMMIT: "fix: wire real Cloudflare KV + D1 IDs into all wrangler.toml files"

Phase 2 — Migrations (est. 20 min)
[ ] DEPLOY-005  Apply all migrations to staging D1 (manual wrangler CLI)
[ ]             Verify 8 previously-missing tables exist (SQL check above)
[ ]             Resolve migration sequence gap 0038–0041
[ ] COMMIT: "fix: add placeholder migrations 0038-0041, all migrations verified on staging D1"

Phase 3 — Security (est. 2 hours)
[ ] SEC-001     Fix tenant impersonation in social.ts + community.ts
[ ] SEC-002     Create migration 0187 — bakery + cleaning-service REAL → INTEGER
[ ] SEC-003     Create migration 0188 — community moderation confidence REAL → INTEGER
[ ] SEC-004     Add DELETE /me NDPR erasure endpoint
[ ] SEC-005     Fix rate-limit.ts: Retry-After header + KV graceful degradation + CF-Connecting-IP key
[ ] COMMIT: "fix: SEC-001-005 — tenant isolation, P9 float columns, NDPR erasure, rate-limit hardening"

Phase 4 — Smoke Tests (est. 30 min)
[ ] TEST-001    Add GET /version to health.ts
[ ] TEST-002    Create tests/smoke/package.json + add to pnpm workspace
[ ] TEST-003    Fix SMOKE_API_KEY silent fallback
[ ] COMMIT: "fix: smoke test wiring — /version endpoint, package.json, SMOKE_API_KEY guard"

Phase 5 — CI Hardening (est. 20 min)
[ ] OPS-001     Enable GitHub environment protection on production (UI — no code)
[ ] OPS-002     Fix deploy-production.yml job dependency ordering
[ ] OPS-003     Create migration 0189 — rename billing_history.amount_naira → amount_kobo
[ ] OPS-004     Fix negotiation-expiry.ts CRON audit tenant_id
[ ] COMMIT: "fix: CI hardening — production approval gate, audit dep, billing column rename, CRON tenant_id"

Deploy Sequence
[ ] Push to staging branch → CI runs → D1 migrations apply → Worker deploys → smoke tests run
[ ] Verify smoke tests pass in CI (all 5 suites green)
[ ] Create PR: staging → main
[ ] Approve production deployment in GitHub UI (OPS-001 gate)
[ ] Monitor Cloudflare Workers dashboard for first 15 minutes
[ ] Run manual smoke test against production URL
```

---

## Expected Score After Completion

| Dimension | Before | After |
|---|---|---|
| TypeScript clean | 20/20 | 20/20 |
| Migrations applied to remote D1 | 0/20 | 20/20 |
| `wrangler.toml` complete | 3/15 | 15/15 |
| Security (no CRITICAL open) | 8/20 | 20/20 |
| Routes mounted (all 124) | 15/15 | 15/15 |
| Tests passing | 1/10 | 10/10 |
| **Total** | **47/100** | **100/100** |

---

*End of Remediation Plan — WebWaka OS — 2026-04-10*
