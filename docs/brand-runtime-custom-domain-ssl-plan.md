# brand-runtime — Custom Domain & SSL Implementation Plan
**Date:** 2026-04-14
**Scope:** Cloudflare for SaaS CNAME onboarding for white-label tenant custom domains
**Worker:** `webwaka-brand-runtime-staging` / `webwaka-brand-runtime-production`
**Repo HEAD:** `main` branch, reviewed 2026-04-14

---

## 1. Current-State Assessment

### 1.1 What Exists

**Evidence from codebase — confirmed, not inferred.**

| Component | File | Status | Evidence |
|---|---|---|---|
| `tenant_resolve` middleware | `apps/brand-runtime/src/middleware/tenant-resolve.ts` | ✅ Exists | Priority 1: `SELECT tenant_slug FROM tenant_branding WHERE custom_domain = ?` |
| `TenantTheme.customDomain` field | `apps/brand-runtime/src/lib/theme.ts` L95 | ✅ Exists | `custom_domain: string \| null` in SELECT and in result type |
| Subdomain fallback pattern | `tenant-resolve.ts` L31–34 | ✅ Exists | `brand-{slug}.webwaka.ng` regex match |
| Slug path fallback | `tenant-resolve.ts` L37–39 | ✅ Exists | `c.req.param('slug')` |
| `wrangler.toml` comment about CF for SaaS | `apps/brand-runtime/wrangler.toml` L5 | ✅ Exists | "Routes: brand-*.webwaka.ng/* and custom domains (CNAME via Cloudflare for SaaS)" |
| THEME_CACHE KV namespace | `wrangler.toml` | ✅ Exists | staging: `bd24f563`, production: `323d03bf` — both real IDs |
| D1 bindings | `wrangler.toml` | ✅ Correct | staging: `cfa62668`, production: `de1d0935` |
| brand-runtime-staging worker | Cloudflare account | ✅ Deployed | modified `2026-04-10` |
| brand-runtime-production worker | Cloudflare account | ❌ Not deployed | Not in workers list |
| Workers.dev subdomain | Cloudflare account | ✅ `webwaka` | `https://webwaka-brand-runtime-staging.webwaka.workers.dev` |

### 1.2 What Is Partial

| Component | Gap | Impact |
|---|---|---|
| `tenant_branding` DB table | **No migration exists** for this table. `theme.ts` and `tenant-resolve.ts` reference `tenant_branding` with `custom_domain`, `primary_color`, `logo_url` etc. — but no `CREATE TABLE tenant_branding` exists in any of the 191 migrations. | **BLOCKER.** Every custom-domain lookup returns null. The entire custom-domain resolution path is dead at runtime. |
| `organizations.slug` column | `theme.ts` queries `o.slug` but `0002_init_entities.sql` has no `slug` column on `organizations`. | **BLOCKER.** Subdomain resolution (step 2) will also fail — `WHERE o.slug = ?` will error. |
| Entitlement check on custom domain | No guard in `tenant-resolve.ts` or any route checks whether the tenant's subscription plan permits a custom domain. | **Security gap.** Any tenant can set a custom domain in the DB regardless of plan. |
| `whiteLabelDepth` entitlement | `plan-config.ts` defines `whiteLabelDepth: 0|1|2` but no `evaluateCustomDomainRights()` function exists in `evaluate.ts` or `guards.ts`. | Missing gate. |
| `custom_domain_status` column | Nowhere in the codebase is there a status field for custom domain lifecycle (`pending`, `active`, `failed`, `revoked`). The middleware does a raw `custom_domain = ?` lookup with no status check — it would serve a pending/unverified hostname as active. | **Security gap and correctness bug.** |
| CF for SaaS zone | Cloudflare account has **zero zones** configured. No `webwaka.ng` zone exists on the account. CF for SaaS requires a proxied zone on Cloudflare — the SaaS zone (`webwaka.ng`) must be added to the account and on at least a Free plan. | **BLOCKER.** Cannot create custom hostnames without a zone. |
| CI deploy job for brand-runtime | Neither `deploy-staging.yml` nor `deploy-production.yml` deploys brand-runtime. Only `apps/api` is deployed in CI. | brand-runtime is deployed manually; no automated pipeline. |
| Worker route (`*/*`) | No Cloudflare Worker route is configured on any zone (zones = 0), so custom hostname traffic cannot reach the brand-runtime Worker. | **BLOCKER.** |

### 1.3 What Is Missing

- **`tenant_branding` migration** — the table does not exist
- **`organizations.slug` migration** — column does not exist
- **`custom_domain_status` column** — lifecycle state for CF for SaaS hostname
- **`cf_hostname_id` column** — Cloudflare custom hostname UUID (needed to DELETE/refresh via API)
- **`cf_ownership_txt_name` / `cf_ownership_txt_value` columns** — for TXT pre-validation surfacing to tenant
- **API route** for tenant to register/verify a custom domain
- **Entitlement guard** `requireCustomDomainRights()` in `packages/entitlements`
- **`custom_domain` write path** — nowhere can a tenant set or update their custom domain; only read path exists
- **CF zone on account** — `webwaka.ng` zone not added to Cloudflare account
- **CF for SaaS enabled** — not enabled on any zone
- **Fallback origin** — not configured
- **Worker route `*/*`** — not configured on `webwaka.ng` zone
- **Webhook handler** for CF for SaaS status callbacks (optional but important for real-time status sync)
- **Brand-runtime production deploy** — worker not deployed to production

### 1.4 Unsafe Assumptions in Current Code

| Assumption | Location | Why It's Unsafe |
|---|---|---|
| `tenant_branding` exists | `tenant-resolve.ts` L27, `theme.ts` L79 | Table does not exist — will throw D1 error at runtime |
| `organizations.slug` exists | `theme.ts` L82 | Column does not exist — will throw D1 error |
| Any host in DB is valid | `tenant-resolve.ts` L27–29 | No status check — a pending/failed CF hostname would still resolve, serving a tenant whose SSL is not yet provisioned |
| Custom domain lookup is safe from takeover | `tenant-resolve.ts` | If a tenant sets `custom_domain` to a domain they don't own (or a malicious actor manipulates a row), the middleware serves it without any CF-side verification check |
| KV THEME_CACHE keyed by slug only | `theme.ts` L58 `theme:${tenantSlug}` | If two tenants have the same slug on different hostnames (edge case), cache may serve wrong theme |

### 1.5 Must Confirm Before Implementation

1. **HUMAN ACTION REQUIRED:** Confirm `webwaka.ng` nameservers are delegated to Cloudflare (NS records pointing to Cloudflare NS). Without this, CF for SaaS cannot function.
2. **HUMAN ACTION REQUIRED:** Confirm which Cloudflare plan `webwaka.ng` zone will use. Free plan includes 100 custom hostnames free + $0.10/month per additional. Pro/Business/Enterprise have same pricing but with higher limits.
3. **HUMAN ACTION REQUIRED:** Confirm the desired CNAME target for tenants. Recommendation: `brand.webwaka.ng` (a dedicated subdomain of your SaaS zone acting as the CNAME target / fallback origin anchor).
4. Confirm `custom_domain` entitlement gate plan: which subscription plans should allow custom domains? Recommendation: `pro`, `enterprise`, `partner`, `sub_partner` (i.e., `whiteLabelDepth >= 1`).

---

## 2. Target Design

### 2.1 Architecture Overview

```
Tenant DNS:           shop.acme.com  CNAME →  brand.webwaka.ng
                                                    ↓
Cloudflare SaaS zone: brand.webwaka.ng  (fallback origin = originless AAAA 100::)
                                                    ↓
Worker route */*:     webwaka-brand-runtime-production
                                                    ↓
brand-runtime Worker: tenant-resolve middleware
                      → D1 lookup: SELECT WHERE custom_domain = ? AND custom_domain_status = 'active'
                      → generateCssTokens(slug)
                      → render branded page
```

### 2.2 Full Tenant Custom Domain Onboarding Flow

```
Step 1 — Tenant submits domain in their WebWaka dashboard
  POST /api/workspaces/:workspaceId/custom-domain
  body: { domain: "shop.acme.com" }
  → Server validates: entitlement check (whiteLabelDepth >= 1)
  → Server validates: domain format (no wildcard, no webwaka.ng, valid FQDN)
  → Calls CF for SaaS API: POST /zones/:zone_id/custom_hostnames
    { hostname: "shop.acme.com", ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } } }
  → CF responds with: { id, hostname, ownership_verification: { type: "txt", name, value }, status: "pending" }
  → Saves to tenant_branding:
    custom_domain = "shop.acme.com"
    custom_domain_status = "pending"
    cf_hostname_id = "<CF UUID>"
    cf_ownership_txt_name = "_cf-custom-hostname.shop.acme.com"
    cf_ownership_txt_value = "<CF token>"
  → Returns verification instructions to tenant

Step 2 — Tenant adds DNS records at their registrar
  DNS record 1 (ownership verification — TXT):
    _cf-custom-hostname.shop.acme.com  TXT  "<cf_ownership_txt_value>"
  DNS record 2 (routing — CNAME):
    shop.acme.com  CNAME  brand.webwaka.ng
  (Both can be set in advance before the CNAME goes live)

Step 3 — Cloudflare validates domain ownership and issues SSL
  CF polls TXT record → verifies ownership
  CF issues DV certificate via DigiCert or Let's Encrypt
  Certificate status transitions: initializing → pending_validation → active
  Hostname status transitions: pending → active
  Timeline: typically 5–30 minutes after CNAME + TXT records propagate

Step 4 — WebWaka polls or receives webhook
  GET /zones/:zone_id/custom_hostnames/:cf_hostname_id
  When status = "active" AND ssl.status = "active":
  → UPDATE tenant_branding SET custom_domain_status = 'active' WHERE cf_hostname_id = ?
  → Invalidate THEME_CACHE KV for this tenant (DELETE key)

Step 5 — Traffic flows
  shop.acme.com → Cloudflare edge → Worker route */* → brand-runtime Worker
  brand-runtime: custom_domain = "shop.acme.com", status = "active" → resolves tenant_slug
  → renders branded page with tenant theme

Step 6 — SSL auto-renews
  CF manages certificate renewal automatically (90-day Let's Encrypt or annual DigiCert)
  No action required from tenant or WebWaka unless custom_domain CNAME is removed
```

### 2.3 DNS Requirements for Tenant

Tenants must add exactly two DNS records at their registrar:

| Record type | Name | Value | Purpose |
|---|---|---|---|
| `TXT` | `_cf-custom-hostname.<their-domain>` | `<cf_ownership_txt_value>` from CF API | Domain ownership verification (can be removed after activation) |
| `CNAME` | `<their-domain>` (or `www.<their-domain>`) | `brand.webwaka.ng` | Route traffic through CF for SaaS zone |

> **Apex domain note:** If a tenant wants their apex (`acme.com` not `www.acme.com`), their DNS provider must support CNAME flattening (Cloudflare DNS does; GoDaddy and most traditional registrars do not). For apex support, the CF for SaaS Apex Proxying add-on (Enterprise only) is required, or you document that apex domains require a Cloudflare DNS provider. For MVP, support `www.` and subdomains only.

### 2.4 SSL Lifecycle

| State | Description | Action |
|---|---|---|
| `initializing` | CF is setting up the custom hostname | Show "Pending" in dashboard, no traffic |
| `pending_validation` | CF awaiting TXT or HTTP DCV token | Show DNS instructions to tenant |
| `active` | Certificate issued, traffic flows | Set `custom_domain_status = 'active'` in D1 |
| `pending_expiration` | Cert nearing expiry, CF renewing | No action; CF auto-renews |
| `expired` | CNAME removed before renewal | Set `custom_domain_status = 'failed'`; alert tenant |
| `deleted` | Hostname removed from CF | Set `custom_domain_status = 'revoked'` |

### 2.5 Fallback Behavior

When a request arrives at brand-runtime and the custom domain is not yet active:

- `custom_domain_status != 'active'` → **do not resolve tenant** from that host
- Return a 503 with a branded "Your custom domain is being provisioned — check back in a few minutes" page
- Do NOT fall through to the subdomain/slug pattern from a custom domain host (prevents information leakage)
- Tenant's `brand-<slug>.webwaka.ng` subdomain always works as fallback while waiting

---

## 3. File-by-File Impact Map

### 3.1 New Migrations (infra/db/migrations/)

**File: `0190_tenant_branding.sql`** — **NEW, code**
```sql
CREATE TABLE IF NOT EXISTS tenant_branding (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL UNIQUE,     -- T3: one branding record per tenant
  tenant_slug            TEXT NOT NULL UNIQUE,     -- matches organizations.slug
  display_name           TEXT NOT NULL,
  primary_color          TEXT,
  secondary_color        TEXT,
  accent_color           TEXT,
  font_family            TEXT,
  logo_url               TEXT,
  favicon_url            TEXT,
  border_radius_px       INTEGER,
  -- Custom domain fields
  custom_domain          TEXT UNIQUE,              -- e.g. "shop.acme.com"
  custom_domain_status   TEXT NOT NULL DEFAULT 'none'
                         CHECK (custom_domain_status IN ('none','pending','active','failed','revoked')),
  cf_hostname_id         TEXT UNIQUE,              -- Cloudflare custom hostname UUID
  cf_ownership_txt_name  TEXT,                     -- "_cf-custom-hostname.shop.acme.com"
  cf_ownership_txt_value TEXT,                     -- CF-issued TXT token
  created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant_id ON tenant_branding(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_slug ON tenant_branding(tenant_slug);
-- Critical for tenant-resolve hot path:
CREATE INDEX IF NOT EXISTS idx_tenant_branding_custom_domain
  ON tenant_branding(custom_domain)
  WHERE custom_domain IS NOT NULL AND custom_domain_status = 'active';
CREATE INDEX IF NOT EXISTS idx_tenant_branding_cf_hostname_id
  ON tenant_branding(cf_hostname_id)
  WHERE cf_hostname_id IS NOT NULL;
```

**File: `0191_organizations_slug.sql`** — **NEW, code**

The `organizations` table (migration 0002) has no `slug` column. `theme.ts` queries `o.slug` — this is a broken query at runtime.

```sql
ALTER TABLE organizations ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug
  ON organizations(slug)
  WHERE slug IS NOT NULL;
```

> Note: `slug` is nullable because existing org rows have no slug. Application layer must enforce slug on creation. A follow-up migration should make it NOT NULL after backfill.

---

### 3.2 `apps/brand-runtime/src/middleware/tenant-resolve.ts` — **MODIFY, code**

**Why:** Add `custom_domain_status = 'active'` filter to custom domain lookup. Without this, a pending or failed domain resolves. Also adds clear 503 path for provisioning state.

```typescript
// BEFORE (line 27):
.prepare(`SELECT tenant_slug FROM tenant_branding WHERE custom_domain = ? LIMIT 1`)
.bind(host)

// AFTER:
.prepare(
  `SELECT tenant_slug, custom_domain_status
   FROM tenant_branding
   WHERE custom_domain = ? LIMIT 1`
)
.bind(host)
.first<{ tenant_slug: string; custom_domain_status: string }>();

// Then check status:
if (customDomainRow) {
  if (customDomainRow.custom_domain_status !== 'active') {
    // Domain registered but not yet active — serve provisioning page, not 404
    return c.html(provisioningPage(), 503);
  }
  slug = customDomainRow.tenant_slug;
}
```

Add `provisioningPage()` helper that returns a minimal branded HTML page:
```
"Your custom domain is being set up. It will be ready shortly.
In the meantime, visit brand-{slug}.webwaka.ng"
```

---

### 3.3 `apps/brand-runtime/src/lib/theme.ts` — **MODIFY, code**

**Why:** The `LEFT JOIN tenant_branding tb ON tb.tenant_id = o.id` plus `WHERE o.slug = ?` is broken:
1. `organizations.slug` column doesn't exist yet (fixed by migration 0191)
2. After migration, this join pattern is correct and can be kept

No logic change needed after migrations are applied — but update the SELECT to also include `custom_domain_status` for defensive caching: do not cache theme for a domain with status != 'active'.

```typescript
// Add to SELECT:
tb.custom_domain_status

// Add after cache write:
// Do not cache theme for inactive custom domains
if (row.custom_domain && row.custom_domain_status !== 'active') {
  // Still return theme for slug-based access, but do not cache with custom_domain key
}
```

Also update the `THEME_CACHE` invalidation: when `custom_domain_status` transitions to `active`, the KV cache for `theme:${tenantSlug}` must be deleted so the next request re-reads the updated domain state.

---

### 3.4 `apps/brand-runtime/src/env.ts` — **MODIFY, code**

**Why:** Add `CF_ZONE_ID` and `CF_FOR_SAAS_API_TOKEN` bindings. These are needed if brand-runtime itself calls the CF for SaaS API (e.g., to check hostname status in-flight). Alternatively, this can be handled by the main API worker. **Recommendation: handle CF API calls from `apps/api`, not from brand-runtime.** brand-runtime only reads D1.

No change needed to `env.ts` for brand-runtime itself. Change needed in `apps/api/src/env.ts`:

```typescript
// apps/api/src/env.ts — ADD:
CF_ZONE_ID: string;            // webwaka.ng zone ID
CF_FOR_SAAS_API_TOKEN: string; // Cloudflare API token with custom_hostname:write scope
```

---

### 3.5 `packages/entitlements/src/evaluate.ts` — **MODIFY, code**

**Why:** No `evaluateCustomDomainRights()` function exists. Custom domains must be gated to `whiteLabelDepth >= 1` (pro, enterprise, partner, sub_partner).

```typescript
// ADD to evaluate.ts:
/**
 * Check whether the workspace subscription grants custom domain support.
 * Requires whiteLabelDepth >= 1 (Pro plan and above).
 */
export function evaluateCustomDomainRights(subscription: Subscription): EntitlementDecision {
  if (!isSubscriptionUsable(subscription.status)) {
    return { allowed: false, reason: `Subscription is ${subscription.status}.` };
  }
  const config = PLAN_CONFIGS[subscription.plan];
  if (config.whiteLabelDepth < 1) {
    return {
      allowed: false,
      reason: `Plan '${subscription.plan}' does not include custom domain support. Upgrade to Pro or above.`,
    };
  }
  return { allowed: true };
}
```

---

### 3.6 `packages/entitlements/src/guards.ts` — **MODIFY, code**

**Why:** Add the throwing guard for custom domain entitlement check.

```typescript
// ADD to guards.ts:
export function requireCustomDomainRights(ctx: EntitlementContext): void {
  const config = PLAN_CONFIGS[ctx.subscriptionPlan];
  if (config.whiteLabelDepth < 1) {
    throw new EntitlementError(
      `Access denied: plan '${ctx.subscriptionPlan}' does not include custom domain support. Upgrade to Pro or above.`,
    );
  }
}
```

---

### 3.7 `packages/entitlements/src/index.ts` — **MODIFY, code**

Export the new functions:

```typescript
export { evaluateCustomDomainRights } from './evaluate.js';
export { requireCustomDomainRights } from './guards.js';
```

---

### 3.8 `apps/api/src/routes/workspaces.ts` — **MODIFY, code**

**Why:** Add the custom domain registration, status-check, and deletion endpoints. These are the write path for custom domain lifecycle management.

Add three new routes:

```
POST   /workspaces/:id/custom-domain          → register domain with CF, write to tenant_branding
GET    /workspaces/:id/custom-domain          → return current status + DNS instructions
DELETE /workspaces/:id/custom-domain          → remove from CF + clear tenant_branding row
```

Each route must:
1. Authenticate + resolve `auth` from JWT
2. Verify caller is `admin` or above in the workspace
3. Run `requireCustomDomainRights(entitlementCtx)` — throws 403 if plan too low
4. Call Cloudflare for SaaS API with the CF API token from `c.env.CF_FOR_SAAS_API_TOKEN`

---

### 3.9 `apps/api/src/jobs/cf-hostname-status-sync.ts` — **NEW, code**

**Why:** Cloudflare hostname status must be polled or webhook-received to transition `custom_domain_status` from `pending` → `active` (or `failed`).

Create a CRON job (run every 5 minutes, matches existing `*/15` CRON pattern) that:

```typescript
// Runs on the scheduled handler
// 1. SELECT * FROM tenant_branding WHERE custom_domain_status = 'pending'
// 2. For each row, GET /zones/:CF_ZONE_ID/custom_hostnames/:cf_hostname_id
// 3. If status === 'active' AND ssl.status === 'active':
//    UPDATE tenant_branding SET custom_domain_status = 'active', updated_at = unixepoch()
//    DELETE from THEME_CACHE KV: key = theme:{tenant_slug}
// 4. If status === 'blocked' or ssl.status === 'timed_out':
//    UPDATE tenant_branding SET custom_domain_status = 'failed'
```

Add to `wrangler.toml` triggers (already has `*/15`):

```toml
[[triggers]]
crons = ["*/15 * * * *", "*/5 * * * *"]  # existing + cf-hostname-sync
```

Or keep one `*/5 * * * *` cron and dispatch both tasks from the same scheduled handler.

---

### 3.10 `apps/brand-runtime/wrangler.toml` — **MODIFY, config**

**Why:** Add Worker routes once the `webwaka.ng` zone is added to the Cloudflare account. Without routes, custom hostname traffic goes to fallback origin (AAAA 100::) but doesn't reach the Worker.

```toml
# Production routes (add after webwaka.ng zone is on account)
[[env.production.routes]]
pattern = "brand.webwaka.ng/*"
zone_name = "webwaka.ng"

# The wildcard route that catches custom hostnames:
[[env.production.routes]]
pattern = "*/*"
zone_name = "webwaka.ng"
```

> **Important:** `*/*` catches ALL traffic entering the `webwaka.ng` zone — including API routes. Add an exclusion route for `api.webwaka.ng/*` with `worker = ""` (no worker) to prevent brand-runtime from intercepting API traffic.

---

### 3.11 CI — `deploy-staging.yml` and `deploy-production.yml` — **MODIFY, config**

**Why:** brand-runtime is not deployed by CI. Add a `deploy-brand-runtime` job after `migrate-*`.

```yaml
# In deploy-production.yml, add:
deploy-brand-runtime-production:
  name: Deploy brand-runtime (Production)
  needs: [migrate-production, ci]
  runs-on: ubuntu-latest
  environment: production
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - name: Deploy brand-runtime to Cloudflare Workers
      run: |
        if [ -f "apps/brand-runtime/wrangler.toml" ]; then
          npx wrangler deploy --env production --config apps/brand-runtime/wrangler.toml
        fi
      env:
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

### 3.12 Tests — `apps/brand-runtime/src/` — **NEW, tests**

Add `apps/brand-runtime/src/middleware/tenant-resolve.test.ts` (see Section 6).

---

### 3.13 Secrets — **new Wrangler secrets required**

In `apps/api/wrangler.toml` secrets section comment, add:
```
#   CF_ZONE_ID              — webwaka.ng zone ID (from CF dashboard)
#   CF_FOR_SAAS_API_TOKEN   — CF API token with Zone:Read + Custom Hostnames:Edit scope
```

---

## 4. Implementation Sequence

Work in this exact order. Each step depends on the previous.

### Step 1 — Cloudflare account setup (**HUMAN ACTIONS — prerequisite for everything**)

**HUMAN ACTION REQUIRED — Step 1a:** Add `webwaka.ng` zone to the Cloudflare account (`a5f5864b726209519e0c361f2bb90e79`).
- Go to Cloudflare Dashboard → Add Site → enter `webwaka.ng`
- Choose Free plan (or Pro if desired — pricing is the same for custom hostnames)
- Update nameservers at your domain registrar to the two CF NS records provided
- Wait for NS propagation (typically 10–60 minutes)
- Note the zone ID (shown in Dashboard → `webwaka.ng` → Overview)

**HUMAN ACTION REQUIRED — Step 1b:** Enable Cloudflare for SaaS on the `webwaka.ng` zone.
- Go to Dashboard → `webwaka.ng` → SSL/TLS → Custom Hostnames
- Click "Enable Cloudflare for SaaS"
- Confirm Free tier: 100 custom hostnames free, $0.10/month per additional

**HUMAN ACTION REQUIRED — Step 1c:** Create the fallback origin DNS record on `webwaka.ng`.
- Dashboard → `webwaka.ng` → DNS → Add record:
  - Type: `AAAA`
  - Name: `brand` (creates `brand.webwaka.ng`)
  - IPv6: `100::` (reserved address — originless)
  - Proxy status: **Proxied** (orange cloud — required)
- This makes `brand.webwaka.ng` the CNAME target for tenants

**HUMAN ACTION REQUIRED — Step 1d:** Set the fallback origin.
- Dashboard → `webwaka.ng` → SSL/TLS → Custom Hostnames → Fallback Origin
- Set to: `brand.webwaka.ng`
- This tells CF for SaaS to route all custom hostname traffic to this origin, which the Worker route will intercept

**HUMAN ACTION REQUIRED — Step 1e:** Create a Cloudflare API token with Custom Hostnames permissions.
- Dashboard → My Profile → API Tokens → Create Token → Custom Token
- Permissions:
  - Zone: `webwaka.ng` → `SSL and Certificates` → Edit
  - Zone: `webwaka.ng` → `Zone` → Read
- Note the token value → add as Wrangler secret: `wrangler secret put CF_FOR_SAAS_API_TOKEN --env production --config apps/api/wrangler.toml`
- Also add the zone ID as a secret or `[vars]` entry: `CF_ZONE_ID = "<webwaka.ng zone ID>"`

---

### Step 2 — Database migrations (code + deploy)

Create and apply in order:

1. **`0190_tenant_branding.sql`** — creates `tenant_branding` table with all custom domain columns
2. **`0191_organizations_slug.sql`** — adds `slug` column to `organizations`

Apply to staging D1 first:
```bash
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --file infra/db/migrations/0190_tenant_branding.sql
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --file infra/db/migrations/0191_organizations_slug.sql
```

Verify:
```bash
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name='tenant_branding';"
```

---

### Step 3 — Entitlements package (code)

In `packages/entitlements/`:
1. Add `evaluateCustomDomainRights()` to `evaluate.ts`
2. Add `requireCustomDomainRights()` to `guards.ts`
3. Export from `index.ts`
4. Run `pnpm --filter @webwaka/entitlements test` — all entitlements tests must pass

---

### Step 4 — brand-runtime middleware fix (code)

In `apps/brand-runtime/src/middleware/tenant-resolve.ts`:
1. Add `custom_domain_status` to the SELECT
2. Add status check before slug assignment
3. Add `provisioningPage()` helper
4. Add `provisioningPage` return path for non-active custom domains

Run: `pnpm --filter @webwaka/brand-runtime typecheck`

---

### Step 5 — API custom domain routes (code)

In `apps/api/src/routes/workspaces.ts`:
1. Add `POST /workspaces/:id/custom-domain`
2. Add `GET /workspaces/:id/custom-domain`
3. Add `DELETE /workspaces/:id/custom-domain`
4. Each calls CF for SaaS API using `c.env.CF_FOR_SAAS_API_TOKEN` and `c.env.CF_ZONE_ID`
5. Each enforces `requireCustomDomainRights()`

Add to `apps/api/src/env.ts`:
```typescript
CF_ZONE_ID: string;
CF_FOR_SAAS_API_TOKEN: string;
```

---

### Step 6 — CRON status-sync job (code)

In `apps/api/src/jobs/cf-hostname-status-sync.ts`:
1. Query `tenant_branding WHERE custom_domain_status = 'pending'`
2. For each, GET CF API custom hostname status
3. Transition `pending` → `active` or `failed`
4. On `active`: DELETE `THEME_CACHE` KV for that slug

Wire into `apps/api/src/index.ts` `scheduled()` handler alongside existing negotiation-expiry.

---

### Step 7 — `wrangler.toml` routes (config)

After Step 1 zone setup:
1. Add `[[env.production.routes]]` with `*/*` pattern on `webwaka.ng` to `apps/brand-runtime/wrangler.toml`
2. Add exclusion route for `api.webwaka.ng/*` with no worker (to prevent routing API traffic through brand-runtime)
3. Repeat for staging zone if a staging `webwaka.ng` subdomain or separate zone is used

**HUMAN ACTION REQUIRED:** Add the `*/*` Worker route in the Cloudflare Dashboard after deploying brand-runtime, OR rely on `wrangler.toml` routes which are applied automatically on `wrangler deploy`.

---

### Step 8 — Secrets deployment

```bash
# CF for SaaS API token
wrangler secret put CF_FOR_SAAS_API_TOKEN --env staging --config apps/api/wrangler.toml
wrangler secret put CF_FOR_SAAS_API_TOKEN --env production --config apps/api/wrangler.toml

# Zone ID (can be a var, not a secret)
# Add to wrangler.toml [env.production.vars]: CF_ZONE_ID = "<zone_id>"
```

---

### Step 9 — Tests (code)

Write and pass all tests from Section 6.

---

### Step 10 — Staging deploy and validation

1. Deploy brand-runtime to staging: `npx wrangler deploy --env staging --config apps/brand-runtime/wrangler.toml`
2. Deploy API to staging (picks up new routes)
3. Add a test custom hostname via CF API to staging zone
4. Verify full flow end-to-end with a test domain

---

### Step 11 — Production deploy

1. Merge to `main` → CI deploys API + brand-runtime (after CI job added in Step 3.11)
2. **HUMAN ACTION REQUIRED:** After deploy, verify Worker route `*/*` is active on `webwaka.ng` zone in CF dashboard
3. Monitor error rates and CF custom hostname status for first 30 minutes

---

## 5. Security and Tenancy Concerns

### 5.1 Domain Ownership Verification

**Mechanism:** CF for SaaS issues a TXT record (`_cf-custom-hostname.<tenant-domain>`) that the tenant must add to their authoritative DNS. Cloudflare verifies this before marking the hostname as active and issuing SSL.

**What this prevents:** A tenant registering `google.com` or any domain they don't control. CF will not issue a certificate or activate the hostname until the TXT record is verified.

**Your responsibility:** Surface the `cf_ownership_txt_name` and `cf_ownership_txt_value` to the tenant clearly in the dashboard UI. Do not activate on your side until CF confirms `status === 'active'`.

### 5.2 Tenant Isolation

**Current risk:** `tenant-resolve.ts` resolves a tenant from a host header with no status check. After the fix (Step 4), only `custom_domain_status = 'active'` rows resolve. A tenant cannot serve content for another tenant's domain because the custom domain is `UNIQUE` in `tenant_branding` — one row per custom domain.

**Cross-tenant read attack:** If tenant A registers `shop.acme.com` and tenant B somehow gets the same value in `custom_domain`, the `UNIQUE` constraint prevents this at DB level.

**Host header injection:** The brand-runtime Worker reads `c.req.header('host')`. On Cloudflare Workers, the `host` header is the actual hostname of the request — it cannot be spoofed by the caller because CF edge rewrites it. This is safe.

### 5.3 Host Header Trust Boundaries

On Cloudflare Workers:
- The `host` header reflects the actual incoming hostname (e.g., `shop.acme.com`)
- It is set by the CF edge, not by the end client
- It is safe to use for routing decisions

However: **never trust `X-Forwarded-Host` or `X-Original-Host` headers** — these are client-controlled. The current code uses `c.req.header('host')` which is correct.

### 5.4 Phishing and Domain Takeover Prevention

**Scenario 1 — Tenant registers a domain they don't own:**
CF TXT verification prevents this. Without the TXT record, CF never marks the hostname active, and WebWaka never sets `custom_domain_status = 'active'`.

**Scenario 2 — Tenant removes CNAME after activation:**
CF monitors custom hostname DNS. If the CNAME stops pointing to `brand.webwaka.ng`, CF marks the hostname as `moved_or_deleted`. Your CRON job detects this and sets `custom_domain_status = 'failed'`. On the next request, brand-runtime serves the provisioning page or 404 instead of tenant content.

**Scenario 3 — Subdomain takeover:**
The `UNIQUE` constraint on `tenant_branding.custom_domain` prevents two tenants from claiming the same domain. Admin API must not allow overwriting an existing active domain row without first deleting the CF hostname and clearing the DB row.

**Scenario 4 — Wildcard domain registration:**
Reject any `custom_domain` value that starts with `*` or contains wildcards in the domain registration API route. Validate format: must be a valid FQDN, must not be `*.anything`, must not be `webwaka.ng` or any subdomain of `webwaka.ng`.

```typescript
// Validation in POST /workspaces/:id/custom-domain:
const domainSchema = z.string()
  .regex(/^(?!.*\*)[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/, 
         'Invalid domain format')
  .refine(d => !d.endsWith('webwaka.ng'), 'Cannot use webwaka.ng domains')
  .refine(d => !d.endsWith('workers.dev'), 'Cannot use workers.dev domains');
```

**Scenario 5 — SSL certificate for wrong domain:**
CF for SaaS issues the certificate only for the exact `hostname` passed to the API. CF performs DCV before issuing. This is Cloudflare's responsibility and is handled correctly by default.

### 5.5 Certificate Provisioning Failure Handling

If DCV fails (TXT record not set, or DNS doesn't propagate in time):
- CF enters a backoff schedule (retries at 1 min, 5 min, 30 min, 4 hours, 24 hours intervals)
- After 7 days without successful DCV, CF marks the hostname as `timed_out`
- Your CRON job detects `ssl.status === 'timed_out'` and sets `custom_domain_status = 'failed'`
- Surface this to the tenant: "Your domain verification failed. Remove and re-add your domain to retry."

---

## 6. Test Plan

### 6.1 `apps/brand-runtime/src/middleware/tenant-resolve.test.ts` (new)

```typescript
describe('tenantResolve middleware', () => {
  // T1: valid active custom domain resolves to tenant slug
  test('resolves active custom domain to tenant slug', async () => {
    // Mock D1: return { tenant_slug: 'acme', custom_domain_status: 'active' }
    // Mock request host: 'shop.acme.com'
    // Expect: c.get('tenantSlug') === 'acme'
  });

  // T2: pending custom domain returns 503 provisioning page (not 404, not tenant content)
  test('returns 503 for pending custom domain', async () => {
    // Mock D1: return { tenant_slug: 'acme', custom_domain_status: 'pending' }
    // Mock request host: 'shop.acme.com'
    // Expect: response.status === 503
    // Expect: response body contains provisioning message
  });

  // T3: failed custom domain returns 503 (not 404)
  test('returns 503 for failed custom domain', async () => {
    // Mock D1: return { tenant_slug: 'acme', custom_domain_status: 'failed' }
    // Expect: 503
  });

  // T4: unknown host (no match in DB) returns 404
  test('returns 404 for completely unknown host', async () => {
    // Mock D1: return null
    // Mock request host: 'unknown.example.com'
    // Expect: 404 (not 503 — host not found at all)
  });

  // T5: valid brand-{slug}.webwaka.ng subdomain resolves correctly
  test('resolves brand-subdomain pattern', async () => {
    // Mock request host: 'brand-acme.webwaka.ng'
    // Expect: c.get('tenantSlug') === 'acme'
  });

  // T6: slug route param fallback resolves correctly
  test('resolves from route param slug', async () => {
    // Mock c.req.param('slug') = 'acme'
    // Mock DB: null (no custom domain match)
    // Expect: c.get('tenantSlug') === 'acme'
  });

  // T7: X-Forwarded-Host must NOT be used for resolution
  test('does not use X-Forwarded-Host for resolution', async () => {
    // Mock request: host = 'brand-acme.webwaka.ng', X-Forwarded-Host = 'shop.malicious.com'
    // Expect: slug resolved from `host` header only → 'acme'
    // X-Forwarded-Host is ignored
  });

  // T8: webwaka.ng internal host not matched as custom domain
  test('brand-subdomains do not trigger custom_domain lookup', async () => {
    // Mock request host: 'brand-acme.webwaka.ng'
    // D1 custom_domain query should NOT be called for webwaka.ng hosts
    // (optimization + security: internal domains skip the custom domain DB read)
  });
});
```

### 6.2 `apps/api/src/routes/workspaces.test.ts` (extend)

```typescript
describe('POST /workspaces/:id/custom-domain', () => {
  // T9: rejects free plan tenant (whiteLabelDepth = 0)
  // T10: rejects starter plan tenant (whiteLabelDepth = 0)
  // T11: accepts pro plan tenant (whiteLabelDepth = 1)
  // T12: rejects wildcard domain (* in name)
  // T13: rejects webwaka.ng domain (must not use own zone)
  // T14: rejects workers.dev domain
  // T15: rejects duplicate domain (already registered by another tenant)
  // T16: on success, tenant_branding row has status = 'pending', cf_hostname_id set
  // T17: calls CF for SaaS API with correct payload
});

describe('DELETE /workspaces/:id/custom-domain', () => {
  // T18: calls CF API DELETE /custom_hostnames/:id
  // T19: sets tenant_branding.custom_domain_status = 'revoked'
  // T20: invalidates THEME_CACHE for this tenant slug
});

describe('GET /workspaces/:id/custom-domain', () => {
  // T21: returns current status + DNS instructions when pending
  // T22: returns status = 'active' when active
  // T23: returns 404 when no custom domain registered
});
```

### 6.3 `apps/api/src/jobs/cf-hostname-status-sync.test.ts` (new)

```typescript
describe('cf-hostname-status-sync CRON job', () => {
  // T24: transitions pending → active when CF reports active + ssl active
  // T25: does not transition active → pending (idempotent — only pending rows are polled)
  // T26: transitions pending → failed when CF ssl.status = 'timed_out'
  // T27: deletes THEME_CACHE KV key on active transition
  // T28: handles CF API error gracefully (logs, does not crash, retries next cycle)
});
```

---

## 7. Rollout Plan

### 7.1 Staging Validation

1. Deploy migrations 0190 + 0191 to staging D1
2. Deploy brand-runtime to staging
3. Deploy API to staging (new custom-domain routes + CRON job)
4. **HUMAN ACTION REQUIRED:** Register a test domain you own (e.g., a spare subdomain) in staging
5. Add the CF TXT record and CNAME at your registrar
6. Wait for CF to activate the hostname (monitor via `GET /zones/:zone_id/custom_hostnames/:id`)
7. Verify:
   - Brand-runtime serves correct tenant content at the test domain
   - HTTPS works (no cert error)
   - `brand-<slug>.webwaka.ng` still works (subdomain fallback unaffected)
   - POST/GET/DELETE custom domain API routes return correct responses
   - CRON job transitions pending → active correctly
   - Attempting to register a domain without owning it stays in `pending` indefinitely (no activation)

### 7.2 Production Rollout

1. Apply migrations 0190 + 0191 to production D1 (migrations are additive, zero downtime)
2. Deploy API to production — new routes available but no tenant has custom domains yet
3. **HUMAN ACTION REQUIRED:** Complete Step 1 (zone setup) on production if not done during staging
4. Deploy brand-runtime to production
5. **HUMAN ACTION REQUIRED:** Verify `*/*` Worker route is active on `webwaka.ng` zone in CF dashboard
6. Enable custom domain feature in WebWaka tenant dashboard (feature flag or simply by the routes being available)

### 7.3 Tenant-by-Tenant Enablement

- Entitlement check (`requireCustomDomainRights`) gates access by subscription plan automatically
- No additional tenant-by-tenant enablement needed beyond plan gating
- Optionally: add a `custom_domain_enabled` feature flag to `tenant_branding` for individual tenant-level control without changing their plan

### 7.4 Rollback Strategy

| Scenario | Rollback |
|---|---|
| brand-runtime breaking change | `wrangler rollback --env production --config apps/brand-runtime/wrangler.toml` — previous Worker version restored in <1 min |
| API route regression | `wrangler rollback` for webwaka-api; all new custom-domain routes are additive, no breaking changes to existing routes |
| Migration 0190/0191 regression | Migrations are additive (new table + new column). If needed: `DROP TABLE tenant_branding` and `ALTER TABLE organizations DROP COLUMN slug` on staging only. Production rollback of additive migrations is safe — no existing code breaks if the new table exists but is unused. |
| CF for SaaS misconfiguration | Remove the `*/*` Worker route on `webwaka.ng` zone in CF dashboard → all custom hostname traffic stops reaching brand-runtime, falls through to fallback origin (AAAA 100:: → connection reset). This is visible but safe — no existing `webwaka.ng` traffic is affected (it routes through `api.webwaka.ng` etc., not the brand-runtime zone). |

### 7.5 Monitoring and Alerting

After launch, monitor:

1. **CF Custom Hostname Status** — poll `GET /zones/:zone_id/custom_hostnames?status=pending` daily; alert if any hostname has been pending > 24 hours
2. **brand-runtime error rate** — Cloudflare Workers dashboard → brand-runtime-production → errors; alert on >1% 5xx rate
3. **CRON job execution** — log each status-sync run with count of transitions; alert on consecutive CRON failures
4. **THEME_CACHE KV hit rate** — monitor KV reads vs DB reads; high DB reads = cache not working
5. **D1 query latency** — the `custom_domain` index lookup should be <5ms; alert on sustained >50ms

---

## 8. Final Recommendation

**Recommended implementation path:** proceed with the plan above as written.

**Key decisions locked in:**

1. **Use CF for SaaS (custom hostnames) not a manual DNS proxy.** The platform's reliance on Cloudflare Workers makes CF for SaaS the natural fit. CF manages SSL issuance, renewal, and certificate lifecycle entirely. There is no alternative on this stack that provides the same zero-operational-overhead SSL management.

2. **Use Workers as fallback origin (`brand.webwaka.ng` AAAA 100::).** The brand-runtime Worker already handles routing. Adding a Worker route `*/*` on the SaaS zone is the correct pattern per CF documentation and community-confirmed to work. Individual custom hostname routes are not needed — the wildcard covers all.

3. **Use TXT pre-validation, not HTTP validation.** HTTP validation requires the tenant's origin server to serve a token at a specific URL — it couples validation to your infrastructure. TXT validation is done entirely at the tenant's DNS registrar with no dependency on your servers.

4. **Pending domains must return 503, not tenant content.** This is a correctness and security requirement. Serving content for a hostname whose SSL is not yet provisioned is incorrect behavior. Serving a provisioning page at 503 is the right UX.

5. **Custom domains gated to `whiteLabelDepth >= 1` (Pro plan and above).** This aligns with the existing entitlement matrix and prevents free/starter tenants from attempting a feature that requires account-level CF for SaaS setup.

6. **The single most important pre-condition is the Cloudflare zone.** The account currently has zero zones. Nothing else in this plan works until `webwaka.ng` is added to the account and nameservers are updated. This is the first action to take.

**Estimated effort:** 3–4 engineering days for code + 1–2 hours for Cloudflare account setup (human actions).

**Priority order of human actions:**
1. Add `webwaka.ng` zone to Cloudflare account (blocks everything)
2. Enable CF for SaaS on zone (blocks custom hostname creation)
3. Create `brand.webwaka.ng` AAAA 100:: DNS record (blocks fallback origin)
4. Set fallback origin (blocks traffic routing)
5. Create CF API token (blocks programmatic hostname management)

---

*End of plan — WebWaka OS brand-runtime Custom Domain & SSL — 2026-04-14*
