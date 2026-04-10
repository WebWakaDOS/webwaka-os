# WebWaka OS — Superagent Implementation Prompt
## Production Remediation Plan Execution

**Document type:** Agent execution brief  
**Prepared:** 2026-04-10  
**Repo:** `https://github.com/WebWakaDOS/webwaka-os` (branch: `main`)  
**Source plan:** `docs/production-remediation-plan-2026-04-10.md`  
**Audit baseline:** 47 / 100 deployment readiness  
**Target:** 100 / 100 — platform live on Cloudflare Workers, smoke tests green, users onboarding

---

## STOP FIRST — Read Before Executing Anything

### Critical Pre-Flight Actions (Do These Before Any Other Task)

**A) The Cloudflare API token in the remediation plan is exposed in the public GitHub repo.**

The prior audit agent committed this to `docs/production-remediation-plan-2026-04-10.md`:
```
CLOUDFLARE_API_TOKEN="mx5yewdNFpT7oGZxt81BdUKJ1UF3_tUaiVL0rrG_"
```
This is now public on GitHub. You must immediately:
1. Check if `CLOUDFLARE_API_TOKEN` is available as an environment variable: `echo $CLOUDFLARE_API_TOKEN | wc -c`
2. If it matches the exposed token, alert the operator to rotate it at https://dash.cloudflare.com/profile/api-tokens
3. Do NOT use the hardcoded token string from the document — always use `$CLOUDFLARE_API_TOKEN` from the environment
4. Do NOT re-commit or reference the raw token string in any file you create

**B) CLOUDFLARE_API_TOKEN may not be set in this environment.**

Run: `echo $CLOUDFLARE_API_TOKEN | wc -c`
- If result is `1` (empty): Cloudflare CLI operations (DEPLOY-001, DEPLOY-005) CANNOT run autonomously. Mark them as "requires operator action" and document the exact commands for the operator to run manually. Continue with all code-only tasks.
- If result is > 1: You have the token. Proceed with Cloudflare CLI operations.

**C) Pull the latest from origin/main before starting.**
```bash
git pull origin main
```

**D) Confirm zero TypeScript errors before touching any code.**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3
# Must print 0 errors — do not proceed if errors exist
```

---

## Overview of All Tasks

| ID | Phase | Effort | Autonomous? | Blocks Deploy? |
|---|---|---|---|---|
| DEPLOY-001 | Cloudflare Wiring | 10 min | Needs CF token | YES — nothing deploys without KV IDs |
| DEPLOY-002 | Cloudflare Wiring | 5 min | YES (code) | YES |
| DEPLOY-003 | Cloudflare Wiring | 5 min | YES (code) | YES |
| DEPLOY-004 | Cloudflare Wiring | 5 min | YES (code) | YES |
| DEPLOY-005 | Migrations | 15 min | Needs CF token | YES |
| MIGRATE-GAP | Migrations | 5 min | YES (code) | YES |
| SEC-001 | Security — CRITICAL | 30 min | YES | YES — data breach risk |
| SEC-002 | Security — CRITICAL | 30 min | YES | YES — P9 violation |
| SEC-003 | Security — CRITICAL | 20 min | YES | YES — P9 violation |
| SEC-004 | Security — HIGH | 45 min | YES | Compliance |
| SEC-005 | Security — HIGH | 5 min | YES | Reliability |
| TEST-001 | Smoke Tests | 10 min | YES | Smoke suite fails |
| TEST-002 | Smoke Tests | 10 min | YES | CI silent skip |
| TEST-003 | Smoke Tests | 5 min | YES | False green |
| OPS-001 | CI | 5 min | NO — GitHub UI | Production safety |
| OPS-002 | CI | 5 min | YES (YAML) | Low risk |
| OPS-003 | CI | 15 min | YES (migration) | Maintenance |
| OPS-004 | CI | 10 min | YES (code) | Data correctness |

**Execution order: MIGRATE-GAP → SEC-001 → SEC-002 → SEC-003 → SEC-004 → SEC-005 → TEST-001 → TEST-002 → TEST-003 → OPS-002 → OPS-003 → OPS-004 → DEPLOY-002 → DEPLOY-003 → DEPLOY-004 → [commit] → DEPLOY-001 (if CF token available) → DEPLOY-005 (if CF token available) → OPS-001 (manual instruction)**

---

## Platform Context (Read This First)

This is WebWaka OS — a Cloudflare Workers + Hono + D1 multi-tenant SaaS platform for 160+ Nigerian business verticals. Every architectural decision must respect these invariants:

| Invariant | Rule | Violation Severity |
|---|---|---|
| **P9** | All money = `INTEGER` kobo. No floats, no `REAL` columns, no `parseFloat()` on money | CRITICAL |
| **T1** | Production runtime = Cloudflare Workers only. Never add Node.js HTTP code | CRITICAL |
| **T3** | `tenant_id` on every DB record; sourced from **JWT claim** (not HTTP header) on auth routes | CRITICAL |
| **T5** | No hardcoded secrets. All via `wrangler secret put` | CRITICAL |
| **P13** | Nursery/orphanage vertical — no individual child data. Aggregate counts only | HIGH |
| **P14** | DM message content encrypted with AES-GCM | HIGH |

The `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable is available for all git push operations.

---

## MIGRATE-GAP — Fill Migration Sequence Gap 0038–0041

**Execute first** — a gap in migration sequences can cause `wrangler d1 migrations apply` to fail.

**Check:** `ls infra/db/migrations/ | sort | grep "003[89]\|004[01]"`  
If nothing is printed, the files are missing. Create them:

```bash
for n in 0038 0039 0040 0041; do
  cat > "infra/db/migrations/${n}_placeholder.sql" << 'SQL'
-- Sequence placeholder — this migration number was not used in the original schema.
-- Required to maintain contiguous migration numbering for wrangler d1 migrations apply.
SELECT 1;
SQL
  echo "Created ${n}_placeholder.sql"
done
```

**Verify:** `ls infra/db/migrations/ | sort | grep "003[89]\|004[01]"` — must show 4 files.

**Also check for any other gaps:**
```bash
ls infra/db/migrations/ | sort | sed 's/_.*//' | awk 'NR>1{for(i=p+1;i<$1;i++) print "GAP: "sprintf("%04d",i)}{p=$1+0}'
```
If any gaps are found beyond 0038-0041, create placeholder files for each.

---

## SEC-001 — Fix Tenant Impersonation in `social.ts` and `community.ts` [CRITICAL]

**This is the highest priority code fix.** Any authenticated caller can forge `X-Tenant-Id` to access another tenant's data.

**Root cause confirmed:** Both `apps/api/src/routes/social.ts` and `apps/api/src/routes/community.ts` define a `getTenantId()` helper that reads `X-Tenant-Id` from the HTTP request header. Auth-required routes must source `tenant_id` from `c.get('auth').tenantId` (the verified JWT claim) — not from a forgeable header.

### Fix for `apps/api/src/routes/social.ts`

Read the full file first. Then apply these changes:

**Step 1:** Rename the existing helper so it is only used for public (no-auth) routes:
```typescript
// RENAME (line ~52):
// FROM: function getTenantId(c: ...)
// TO:
function getTenantIdFromHeader(c: { req: { header(name: string): string | undefined } }): string | null {
  return c.req.header('X-Tenant-Id') ?? null;
}
```

**Step 2:** In every route handler that calls `c.get('auth')` (auth-required routes), replace:
```typescript
// BEFORE:
const tenantId = getTenantId(c);
if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400);

// AFTER:
const auth = c.get('auth') as { tenantId: string; userId: string };
const tenantId = auth.tenantId;
```

**Auth-required routes to fix in `social.ts`** (any route that creates/mutates data):
- `POST /social/profile/setup`
- `POST /social/follow/:id`
- `GET /social/feed`
- `POST /social/posts`
- `POST /social/posts/:id/react`
- `GET /social/dm/threads`
- `POST /social/dm/threads`
- `POST /social/dm/threads/:id/messages`
- `GET /social/stories`
- `POST /social/stories`

**Public routes — keep `getTenantIdFromHeader(c)` for these only:**
- `GET /social/profile/:handle`

**Step 3:** Apply the same pattern to `apps/api/src/routes/community.ts`:

Auth-required routes (fix to use `c.get('auth').tenantId`):
- `POST /community/channels/:id/posts`
- `POST /community/lessons/:id/progress`
- `POST /community/events/:id/rsvp`
- `POST /community/join`
- Any other route using auth middleware

Public routes (keep header-based):
- `GET /community/:slug`
- `GET /community/:id/channels`
- `GET /community/:id/courses`
- `GET /community/:id/events`
- `GET /community/channels/:id/posts`
- `GET /community/lessons/:id`

**Verification:**
```bash
# Only public routes should still call getTenantIdFromHeader
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error" | wc -l
# Must be 0

grep -n "getTenantId\b" apps/api/src/routes/social.ts | grep -v "getTenantIdFromHeader\|function getTenantIdFromHeader"
# Must return 0 lines (all auth routes now use c.get('auth').tenantId)
```

---

## SEC-002 — Fix P9 Violation: `REAL` Columns in Bakery and Cleaning-Service [CRITICAL]

**Create `infra/db/migrations/0187_fix_p9_inventory_real_columns.sql`:**

```sql
-- Migration 0187 — Fix P9 violations: REAL inventory columns → INTEGER ×1000
-- P9: All measurable quantities must be INTEGER to prevent float arithmetic.
-- Convention: quantity × 1000 stored as INTEGER (divide by 1000 for display).

-- bakery_ingredients: convert REAL quantity columns
ALTER TABLE bakery_ingredients RENAME COLUMN quantity_in_stock TO quantity_in_stock_x1000;
ALTER TABLE bakery_ingredients RENAME COLUMN reorder_level TO reorder_level_x1000;

UPDATE bakery_ingredients SET
  quantity_in_stock_x1000 = CAST(ROUND(quantity_in_stock_x1000 * 1000) AS INTEGER),
  reorder_level_x1000     = CAST(ROUND(reorder_level_x1000 * 1000) AS INTEGER);

-- cleaning_supplies: convert REAL quantity column
ALTER TABLE cleaning_supplies RENAME COLUMN quantity_in_stock TO quantity_in_stock_x1000;

UPDATE cleaning_supplies SET
  quantity_in_stock_x1000 = CAST(ROUND(quantity_in_stock_x1000 * 1000) AS INTEGER);
```

**Update `packages/verticals-bakery/src/types.ts`:**
- In `BakeryIngredient` interface: rename `quantityInStock: number` → `quantityInStockX1000: number` and `reorderLevel: number` → `reorderLevelX1000: number`
- In `CreateBakeryIngredientInput` interface: same renames (make them optional with `?`)

**Update `packages/verticals-bakery/src/bakery.ts`:**
- In `toIngredient()`: map `r['quantity_in_stock_x1000']` → `quantityInStockX1000`, `r['reorder_level_x1000']` → `reorderLevelX1000`
- In any INSERT: use `quantity_in_stock_x1000`, `reorder_level_x1000` column names

**Update `packages/verticals-cleaning-service/src/types.ts` and `cleaning-service.ts`:**
- Same pattern: `quantityInStock` → `quantityInStockX1000`, column `quantity_in_stock` → `quantity_in_stock_x1000`

**Verify after changes:**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error" | wc -l  # must be 0
grep -n "quantity_in_stock[^_]" packages/verticals-bakery/src/bakery.ts   # must be 0 lines
grep -n "quantity_in_stock[^_]" packages/verticals-cleaning-service/src/cleaning-service.ts  # must be 0 lines
```

---

## SEC-003 — Fix P9 Violation: `confidence REAL` in Community Moderation Log [CRITICAL]

**Create `infra/db/migrations/0188_fix_p9_moderation_confidence.sql`:**

```sql
-- Migration 0188 — Fix P9 violation: confidence REAL → INTEGER basis points
-- confidence_bps: 0–10000 where 10000 = 100.00% confidence
-- Existing float values (0.0–1.0) multiplied by 10000 and cast to INTEGER.

ALTER TABLE community_moderation_log RENAME COLUMN confidence TO confidence_bps;

UPDATE community_moderation_log SET
  confidence_bps = CAST(ROUND(confidence_bps * 10000) AS INTEGER);
```

**Find and update the moderation write path:**
```bash
grep -rn "confidence" packages/social/ packages/community/ apps/api/src/routes/social.ts apps/api/src/routes/community.ts 2>/dev/null | grep -v "node_modules"
```

For every location that writes `confidence`:
```typescript
// BEFORE: confidence: 0.87
// AFTER: confidence_bps: Math.round(0.87 * 10000)  // = 8700
```

For every location that reads `confidence`:
```typescript
// BEFORE: r['confidence'] as number
// AFTER: r['confidence_bps'] as number  // keep as integer; divide by 10000 for display only
```

**Verify:**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error" | wc -l  # must be 0
grep -rn "\.confidence\b" packages/social/ packages/community/ 2>/dev/null | grep -v "confidence_bps"  # must be 0
```

---

## SEC-004 — Add NDPR Data-Erasure Endpoint `DELETE /auth/me` [HIGH — Compliance]

**Read `apps/api/src/routes/auth-routes.ts` first**, then add the endpoint.

**Add this route to `auth-routes.ts`** (before the final `export`):

```typescript
// DELETE /auth/me — NDPR Article 3.1(9) Right to Erasure
// Anonymises PII in users table. Preserves row for FK integrity.
authRoutes.delete('/me', async (c) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };
  const db = c.env.DB as unknown as { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }> } } };

  const anonRef = `deleted_${crypto.randomUUID()}`;

  // Anonymise user PII — anonymised email is deterministic per erasure request
  await db.prepare(
    `UPDATE users SET
       email         = ?,
       full_name     = 'Deleted User',
       phone         = NULL,
       password_hash = NULL,
       updated_at    = unixepoch()
     WHERE id = ? AND tenant_id = ?`
  ).bind(`${anonRef}@deleted.invalid`, auth.userId, auth.tenantId).run();

  // Purge contact channels (phone numbers, OTP codes)
  await db.prepare(
    `DELETE FROM contact_channels WHERE user_id = ? AND tenant_id = ?`
  ).bind(auth.userId, auth.tenantId).run();

  // Invalidate all active sessions (best-effort — ignore if table not yet created)
  try {
    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(auth.userId).run();
  } catch { /* sessions table may not exist — safe to ignore */ }

  return c.json({
    message: 'Your personal data has been erased in compliance with NDPR Article 3.1(9).',
    erasedAt: new Date().toISOString(),
  }, 200);
});
```

**Verify:**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error" | wc -l  # must be 0
grep -n "delete.*\/me\|DELETE.*\/me" apps/api/src/routes/auth-routes.ts  # must show 1 line
```

---

## SEC-005 — Harden `rate-limit.ts`: `Retry-After` Header + KV Graceful Degradation [HIGH]

**Read `apps/api/src/middleware/rate-limit.ts` first**, then apply these targeted changes:

**Change 1:** Add `Retry-After` header to all 429 responses:
```typescript
// Find every place that returns 429 and add the header before the return:
c.header('Retry-After', String(opts.windowSeconds ?? 60));
return c.json({ error: 'rate_limit_exceeded', ... }, 429);
```

**Change 2:** Use `CF-Connecting-IP` as the rate-limit key subject (not `X-User-Id` which is forgeable pre-auth):
```typescript
// BEFORE:
const subject = c.req.header('X-User-Id') ?? c.req.header('CF-Connecting-IP') ?? 'unknown';

// AFTER:
const subject = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
```

**Change 3:** Wrap all KV operations in try/catch (KV unavailability must not crash the API):
```typescript
let count = 0;
try {
  const raw = await kv.get(key);
  count = raw ? parseInt(raw, 10) : 0;
} catch {
  // KV unavailable — fail open to preserve availability
  await next(); return;
}

// ... rate check ...

try {
  await kv.put(key, String(count + 1), { expirationTtl: opts.windowSeconds ?? 60 });
} catch {
  // KV write failed — don't block the request
}
```

**Verify:**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error" | wc -l
grep -n "Retry-After" apps/api/src/middleware/rate-limit.ts  # must appear in 429 response
grep -n "X-User-Id" apps/api/src/middleware/rate-limit.ts   # must be 0 lines (removed)
```

---

## TEST-001 — Add `GET /version` Endpoint to `health.ts` [HIGH]

**Read `apps/api/src/routes/health.ts` first.** Current file only has `GET /` — add `GET /version`:

```typescript
// Add this route after the existing GET / handler, before export:
healthRoutes.get('/version', (c) => {
  // Import version from root package.json at module load time
  return c.json({ version: '1.0.0' });  // TODO: inject from package.json at build
});
```

For the version string, use this approach (avoids JSON import assertion complexity):
```typescript
// At top of health.ts, add:
const API_VERSION = '1.0.0'; // Keep in sync with apps/api/package.json version field

// Then in the route:
healthRoutes.get('/version', (c) => c.json({ version: API_VERSION }));
```

**Verify:**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error" | wc -l
grep -n "version" apps/api/src/routes/health.ts  # must show the new route
```

---

## TEST-002 — Wire Smoke Tests into pnpm Workspace [LOW]

**Create `tests/smoke/package.json`:**

```json
{
  "name": "smoke",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "smoke:staging": "tsx api-health.smoke.ts",
    "smoke:production": "tsx api-health.smoke.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.2"
  }
}
```

**Add `tests/smoke` to `pnpm-workspace.yaml`:**

Read `pnpm-workspace.yaml` first. Then add:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tests/smoke'    # ← add this line
```

**Verify:**
```bash
cat pnpm-workspace.yaml | grep "tests/smoke"  # must print the line
cat tests/smoke/package.json | grep "smoke:staging"  # must print the script
```

---

## TEST-003 — Fix `SMOKE_API_KEY` Silent Fallback [MEDIUM]

**Edit `tests/smoke/api-health.smoke.ts` line 14.**

Read the file first, then replace:
```typescript
// BEFORE:
const API_KEY = process.env['SMOKE_API_KEY'] ?? 'smoke-key-not-set';

// AFTER:
const API_KEY = process.env['SMOKE_API_KEY'];
if (!API_KEY) {
  console.error('[smoke] FATAL: SMOKE_API_KEY environment variable is not set. Exiting.');
  process.exit(1);
}
```

**Verify:**
```bash
grep -n "smoke-key-not-set" tests/smoke/api-health.smoke.ts  # must be 0 lines
grep -n "process.exit(1)" tests/smoke/api-health.smoke.ts    # must show 1 line
```

---

## OPS-002 — Fix Production Deploy Job Dependency [LOW]

**Read `.github/workflows/deploy-production.yml` first**, then find the `deploy-api-production` job and update its `needs`:

```yaml
# FIND and UPDATE:
deploy-api-production:
  needs: [migrate-production, ci]   # ensure ci (which runs audit) must complete first
```

If the `needs` field already includes `ci` or the relevant job, skip this task.

---

## OPS-003 — Rename `billing_history.amount_naira` → `amount_kobo` [MEDIUM]

**Create `infra/db/migrations/0189_fix_billing_amount_column_name.sql`:**

```sql
-- Migration 0189 — Rename billing_history.amount_naira → amount_kobo
-- The column stores INTEGER kobo but was named "amount_naira" — misleading.
-- No value transformation needed (values are already correct kobo integers).

ALTER TABLE billing_history RENAME COLUMN amount_naira TO amount_kobo;
```

**Update `apps/api/src/routes/payments.ts`** — read the file first, then:
```bash
# Find all references:
grep -n "amount_naira\|amountNaira" apps/api/src/routes/payments.ts
```

For each reference:
- `amount_naira` in SQL strings → `amount_kobo`
- `amountNaira` in TypeScript types/objects → `amountKobo`
- Keep the same values — only rename, no arithmetic

**If `packages/types/src/entities.ts` has `BillingHistory`:**
```bash
grep -n "amountNaira\|amount_naira" packages/types/src/entities.ts
```
Rename field if found.

**Verify:**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error" | wc -l  # 0
grep -rn "amount_naira\|amountNaira" apps/ packages/ --include="*.ts" | grep -v ".sql"  # 0 lines
```

---

## OPS-004 — Fix CRON Negotiation-Expiry Audit `tenant_id` [LOW]

**Read `apps/api/src/jobs/negotiation-expiry.ts` first.**

Find the expiry case (line ~27 in the plan; the exact line may differ — search for `tenant_id: 'system'`):

```bash
grep -n "'system'" apps/api/src/jobs/negotiation-expiry.ts
```

Replace `tenant_id: 'system'` with `tenant_id: session.tenant_id` (or equivalent — use the actual session object's tenant_id property):

```typescript
// BEFORE:
await repo.createAuditEntry({
  tenant_id: 'system',
  ...
});

// AFTER:
await repo.createAuditEntry({
  tenant_id: session.tenant_id,   // use the real tenant from the expired session
  ...
});
```

**Verify:**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error" | wc -l  # 0
grep -n "'system'" apps/api/src/jobs/negotiation-expiry.ts  # must be 0 lines
```

---

## DEPLOY-002 — Fix `apps/api/wrangler.toml` [BLOCKER]

**This must happen regardless of whether CLOUDFLARE_API_TOKEN is available.** The code changes are needed; only the KV IDs depend on DEPLOY-001.

Read `apps/api/wrangler.toml` in full, then replace the staging and production blocks with the versions from the remediation plan (`docs/production-remediation-plan-2026-04-10.md` → DEPLOY-002 section), using:

**Known real values (use these directly):**
- D1 staging: `database_id = "cfa62668-bbd0-4cf2-996a-53da76bab948"` and `database_name = "webwaka-os-staging"`
- D1 production: `database_id = "de1d0935-31ed-4a33-a0fd-0122d7a4fe43"` and `database_name = "webwaka-os-production"`
- `RATE_LIMIT_KV` staging: `id = "608eacac3eb941a68c716b14e84b4d10"`
- `RATE_LIMIT_KV` production: `id = "af260e847d1e400e94cf13f6ae3214eb"`

**For KV IDs that require DEPLOY-001 (GEOGRAPHY_CACHE staging/production):**
- If `CLOUDFLARE_API_TOKEN` is available: run DEPLOY-001 first, get the real IDs, then fill them in
- If not available: use the placeholder string `"REQUIRES_OPERATOR_ACTION_SEE_DEPLOY-001"` and add a comment. **Do not block the rest of the work on this.**

Add `APP_BASE_URL` to staging and production vars:
```toml
[env.staging.vars]
ENVIRONMENT = "staging"
APP_BASE_URL = "https://webwaka-api-staging.workers.dev"

[env.production.vars]
ENVIRONMENT = "production"
APP_BASE_URL = "https://api.webwaka.ng"
```

**Remove all comment lines about "pending migrations"** from the top of the file — these are now tracked via the migration sequence, not via wrangler.toml comments.

**Verify:**
```bash
grep -n "placeholder\|STAGING_GEOGRAPHY\|STAGING_RATE_LIMIT\|PROD_GEOGRAPHY\|PROD_RATE_LIMIT" apps/api/wrangler.toml
# Must return 0 lines (no unresolved placeholder strings remain except for GEOGRAPHY_CACHE if DEPLOY-001 is blocked)
```

---

## DEPLOY-003 — Fix `apps/brand-runtime/wrangler.toml` [BLOCKER]

Read the current file, then update:
- `database_name` staging: `"webwaka-os-staging"`
- `database_id` staging: `"cfa62668-bbd0-4cf2-996a-53da76bab948"`
- `database_name` production: `"webwaka-os-production"`
- `database_id` production: `"de1d0935-31ed-4a33-a0fd-0122d7a4fe43"`
- `THEME_CACHE` KV IDs: if DEPLOY-001 ran, use real IDs; otherwise `"REQUIRES_OPERATOR_ACTION_SEE_DEPLOY-001"`

Follow the template in `docs/production-remediation-plan-2026-04-10.md` → DEPLOY-003 section exactly.

---

## DEPLOY-004 — Fix `apps/public-discovery/wrangler.toml` and `apps/ussd-gateway/wrangler.toml` [BLOCKER]

Same pattern as DEPLOY-003. Read each file first, then apply the template from `docs/production-remediation-plan-2026-04-10.md` → DEPLOY-004 section.

Key fix for `ussd-gateway/wrangler.toml`: `compatibility_date` was `"2024-09-23"` — update to `"2024-12-05"`.

---

## DEPLOY-001 — Create Missing KV Namespaces [BLOCKER — CF Token Required]

**Only execute this block if `echo $CLOUDFLARE_API_TOKEN | wc -c` returns > 1.**

```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"
# DO NOT hardcode the token — use the environment variable:
# export CLOUDFLARE_API_TOKEN is already set

# Geography cache
npx wrangler kv namespace create "GEOGRAPHY_CACHE" --env staging 2>&1 | tee /tmp/kv-geography-staging.txt
npx wrangler kv namespace create "GEOGRAPHY_CACHE" --env production 2>&1 | tee /tmp/kv-geography-production.txt

# Theme cache (brand-runtime)
npx wrangler kv namespace create "THEME_CACHE" --env staging 2>&1 | tee /tmp/kv-theme-staging.txt
npx wrangler kv namespace create "THEME_CACHE" --env production 2>&1 | tee /tmp/kv-theme-production.txt

# Discovery cache
npx wrangler kv namespace create "DISCOVERY_CACHE" --env staging 2>&1 | tee /tmp/kv-discovery-staging.txt
npx wrangler kv namespace create "DISCOVERY_CACHE" --env production 2>&1 | tee /tmp/kv-discovery-production.txt

# USSD session state
npx wrangler kv namespace create "USSD_SESSION_KV" --env staging 2>&1 | tee /tmp/kv-ussd-staging.txt
npx wrangler kv namespace create "USSD_SESSION_KV" --env production 2>&1 | tee /tmp/kv-ussd-production.txt

# Print all created IDs:
echo "=== COPY THESE IDs INTO wrangler.toml FILES ===" && cat /tmp/kv-*.txt
```

After creating the namespaces, extract the IDs from the output and fill them into DEPLOY-002, DEPLOY-003, and DEPLOY-004 wrangler.toml files. Go back and remove any `"REQUIRES_OPERATOR_ACTION_SEE_DEPLOY-001"` placeholders.

**If CF token NOT available:** Skip this block. Write these exact instructions into `docs/operator-runbook.md` for the platform operator to complete manually before first deploy.

---

## DEPLOY-005 — Apply All Migrations to Remote Staging D1 [BLOCKER — CF Token Required]

**Only execute this block if `echo $CLOUDFLARE_API_TOKEN | wc -c` returns > 1 AND DEPLOY-002 is complete (correct database_name).**

```bash
export CLOUDFLARE_ACCOUNT_ID="a5f5864b726209519e0c361f2bb90e79"

# Apply all migrations to staging D1
npx wrangler d1 migrations apply webwaka-os-staging \
  --env staging \
  --migrations-dir infra/db/migrations \
  --remote 2>&1 | tee /tmp/migrations-staging.txt

# Verify the 8 critical tables that were previously missing
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN (
    'search_entries', 'discovery_events', 'vendor_pricing_policies',
    'listing_price_overrides', 'negotiation_sessions', 'negotiation_offers',
    'negotiation_audit_log', 'ministry_members'
  ) ORDER BY name;" 2>&1

# Must show 8 rows — one for each table
```

**Do NOT apply to production** until staging smoke tests pass.

---

## OPS-001 — Enable Production Approval Gate [HIGH — Manual GitHub UI Step]

**This cannot be done via code or CLI.** Write instructions in `docs/operator-runbook.md`:

```markdown
## OPS-001: Enable Production Environment Protection

1. Go to https://github.com/WebWakaDOS/webwaka-os/settings/environments
2. Click "production" environment
3. Enable "Required reviewers" — add the founder/operator GitHub username
4. Optionally enable "Prevent self-review"
5. Save protection rules

This ensures `deploy-api-production` requires a manual approval click before
shipping to production, even on direct push to main.
```

---

## Git Commit Strategy

Make exactly **5 commits** in this order — one per logical group:

```bash
# Commit 1: Migration fixes (no code, just SQL files)
git add infra/db/migrations/0038_placeholder.sql \
        infra/db/migrations/0039_placeholder.sql \
        infra/db/migrations/0040_placeholder.sql \
        infra/db/migrations/0041_placeholder.sql \
        infra/db/migrations/0187_fix_p9_inventory_real_columns.sql \
        infra/db/migrations/0188_fix_p9_moderation_confidence.sql \
        infra/db/migrations/0189_fix_billing_amount_column_name.sql
git commit -m "fix(migrations): fill 0038-0041 gap, fix P9 REAL columns (0187-0188), rename billing column (0189)"

# Commit 2: Critical security fixes (tenant isolation + P9 code changes)
git add apps/api/src/routes/social.ts \
        apps/api/src/routes/community.ts \
        packages/verticals-bakery/src/ \
        packages/verticals-cleaning-service/src/
git commit -m "fix(sec): SEC-001 tenant isolation via JWT claim; SEC-002/003 P9 REAL→INTEGER in bakery, cleaning-service, moderation"

# Commit 3: API + compliance additions
git add apps/api/src/routes/auth-routes.ts \
        apps/api/src/routes/health.ts \
        apps/api/src/middleware/rate-limit.ts \
        apps/api/src/jobs/negotiation-expiry.ts \
        apps/api/src/routes/payments.ts
git commit -m "fix(api): SEC-004 NDPR erasure; SEC-005 rate-limit hardening; TEST-001 /version endpoint; OPS-003 billing column; OPS-004 CRON tenant_id"

# Commit 4: Infrastructure (wrangler.toml + smoke test wiring)
git add apps/api/wrangler.toml \
        apps/brand-runtime/wrangler.toml \
        apps/public-discovery/wrangler.toml \
        apps/ussd-gateway/wrangler.toml \
        tests/smoke/ \
        pnpm-workspace.yaml \
        .github/workflows/deploy-production.yml
git commit -m "fix(infra): wire real D1+KV IDs into all wrangler.toml files; smoke test workspace; CI hardening"

# Commit 5: Operator runbook
git add docs/operator-runbook.md
git commit -m "docs(ops): operator runbook — DEPLOY-001 KV namespaces + OPS-001 production gate manual steps"
```

**Push after all 5 commits:**
```bash
git remote set-url origin "https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/WebWakaDOS/webwaka-os.git"
git push origin main
git remote set-url origin "https://github.com/WebWakaDOS/webwaka-os.git"
```

---

## Final Verification Checklist

Run these commands at the very end and record the output:

```bash
echo "=== TypeScript ===" && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3
echo "=== Migration count ===" && ls infra/db/migrations/ | wc -l
echo "=== Migration gaps ===" && ls infra/db/migrations/ | sort | sed 's/_.*//' | awk 'NR>1{for(i=p+1;i<$1;i++) print "GAP: "sprintf("%04d",i)}{p=$1+0}'
echo "=== Tenant impersonation (must be 0) ===" && grep -c "getTenantId\b" apps/api/src/routes/social.ts apps/api/src/routes/community.ts 2>/dev/null || echo "0"
echo "=== Retry-After header present ===" && grep -c "Retry-After" apps/api/src/middleware/rate-limit.ts
echo "=== NDPR endpoint ===" && grep -c "delete.*\/me" apps/api/src/routes/auth-routes.ts
echo "=== /version endpoint ===" && grep -c "\/version" apps/api/src/routes/health.ts
echo "=== No hardcoded CF token ===" && grep -r "mx5yewdN" apps/ packages/ infra/ .github/ 2>/dev/null | wc -l
echo "=== Smoke package.json ===" && cat tests/smoke/package.json | grep "smoke:staging"
echo "=== P9: no REAL columns in new migrations ===" && grep -i "REAL\b" infra/db/migrations/018[7-9]*.sql 2>/dev/null | wc -l
echo "=== amount_naira gone from TS code ===" && grep -rn "amount_naira\|amountNaira" apps/ packages/ --include="*.ts" 2>/dev/null | wc -l
echo "=== Git log ===" && git log --oneline -6
echo "=== Deployment readiness score ===" && echo "Run this after each phase to estimate score"
```

All checks must pass before considering the implementation complete.

---

## If You Get Stuck

1. **TypeScript errors after a change:** Run `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "error TS"` to find exactly which file + line. Fix only that file. Do not make sweeping changes.

2. **Cannot find a route/method mentioned in the plan:** The plan was written from an audit snapshot. Use `grep -rn "the_function_name" apps/ packages/` to find the actual current location.

3. **KV namespace creation fails:** Check `wrangler whoami` to confirm the API token has Workers KV permissions. If it doesn't, document the exact wrangler commands in `docs/operator-runbook.md` and move on.

4. **Migration apply fails on a specific migration:** Check the SQL for syntax errors. D1 uses SQLite 3 syntax. Common issues: `ADD COLUMN` with constraints (use separate ALTER TABLE), `CREATE TABLE IF NOT EXISTS` (always use this form).

5. **social.ts or community.ts TypeScript errors after SEC-001:** The `c.get('auth')` call may need a type cast. Use `c.get('auth') as { tenantId: string; userId: string }` consistently.

---

## Success Definition

The implementation is complete when all of the following are true:

- [ ] `npx tsc --noEmit -p apps/api/tsconfig.json` → `0 errors`
- [ ] `grep -rn "getTenantId\b" apps/api/src/routes/social.ts apps/api/src/routes/community.ts` → `0 auth-required uses`
- [ ] Migrations 0038–0041, 0187, 0188, 0189 exist in `infra/db/migrations/`
- [ ] All 4 `wrangler.toml` files have real D1 IDs (no truncated or empty values)
- [ ] `RATE_LIMIT_KV` staging/production IDs are real (confirmed values exist in plan)
- [ ] `DELETE /auth/me` NDPR erasure endpoint exists in `auth-routes.ts`
- [ ] `GET /version` endpoint exists in `health.ts`
- [ ] `tests/smoke/package.json` exists with `smoke:staging` script
- [ ] `SMOKE_API_KEY` guard exits with code 1 if unset (no silent fallback)
- [ ] `Retry-After` header present in rate-limit 429 responses
- [ ] `negotiation-expiry.ts` uses `session.tenant_id` not `'system'`
- [ ] `billing_history` column reference in `payments.ts` uses `amount_kobo` not `amount_naira`
- [ ] 5 commits made, pushed to `origin/main`
- [ ] `docs/operator-runbook.md` created with instructions for DEPLOY-001 (if CF token unavailable) and OPS-001

*End of Implementation Brief — WebWaka OS Production Remediation — 2026-04-10*
