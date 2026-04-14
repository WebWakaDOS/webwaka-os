# brand-runtime — Custom Domain & SSL Implementation Plan
**Date:** 2026-04-14
**Scope:** Cloudflare for SaaS CNAME onboarding for white-label tenant custom domains
**Worker:** `webwaka-brand-runtime-staging` / `webwaka-brand-runtime-production`
**Repo HEAD:** `main` branch, reviewed 2026-04-14

---

## Domain Clarification

The platform domain is **`webwaka.com`**, not `webwaka.ng`.

Evidence from codebase:
- `apps/api/src/env.ts` — CORS fallback: `*.webwaka.com`
- `apps/api/src/index.ts` — production CORS: `https://*.webwaka.com`
- `apps/api/src/routes/payments.ts` — callback URL default: `https://app.webwaka.com`
- `infra/cloudflare/environments.md` — DNS entries: `api.webwaka.com`, `admin.webwaka.com`
- `docs/governance/release-governance.md` — production URL: `app.webwaka.com`

The `webwaka.ng` references that appear in brand-runtime source files (`tenant-resolve.ts` subdomain regex, `portal.ts` API URL, `wrangler.toml` comment, USSD gateway routes) are **incorrect and must be fixed** as part of this implementation. These files were scaffolded with the wrong domain. This plan corrects them.

---

## 1. Current-State Assessment

### 1.1 What Exists

**Evidence from codebase — confirmed, not inferred.**

| Component | File | Status | Evidence |
|---|---|---|---|
| `tenantResolve` middleware | `apps/brand-runtime/src/middleware/tenant-resolve.ts` | ✅ Exists | Priority-1 custom domain lookup via `SELECT tenant_slug FROM tenant_branding WHERE custom_domain = ?` |
| `TenantTheme.customDomain` field | `apps/brand-runtime/src/lib/theme.ts` L95 | ✅ Exists | `custom_domain: string \| null` in SELECT and in result type |
| Subdomain fallback pattern | `tenant-resolve.ts` L31–34 | ✅ Exists (wrong domain) | Regex targets `webwaka.ng` — must be changed to `webwaka.com` |
| Slug path fallback | `tenant-resolve.ts` L37–39 | ✅ Exists | `c.req.param('slug')` — correct |
| `wrangler.toml` THEME_CACHE KV | `apps/brand-runtime/wrangler.toml` | ✅ Correct IDs | staging: `bd24f563`, production: `323d03bf` |
| D1 bindings | `apps/brand-runtime/wrangler.toml` | ✅ Correct | staging: `cfa62668`, production: `de1d0935` |
| `brand-runtime-staging` worker | Cloudflare account | ✅ Deployed | modified `2026-04-10` |
| Workers.dev subdomain | Cloudflare account | ✅ `webwaka` | `https://webwaka-brand-runtime-staging.webwaka.workers.dev` |
| Entitlements `whiteLabelDepth` | `packages/entitlements/src/plan-config.ts` | ✅ Exists | `whiteLabelDepth: 0|1|2` on every plan — hook exists for custom domain gating |

### 1.2 What Is Partial

| Component | Gap | Impact |
|---|---|---|
| `tenant_branding` DB table | **No migration exists.** `theme.ts` and `tenant-resolve.ts` reference `tenant_branding` — but no `CREATE TABLE tenant_branding` exists in any of the 191 migrations. | **BLOCKER.** Every custom-domain lookup is a runtime D1 error. The entire feature is dead. |
| `organizations.slug` column | `theme.ts` queries `o.slug` but `0002_init_entities.sql` has no `slug` column. | **BLOCKER.** Subdomain resolution also fails — `WHERE o.slug = ?` errors at runtime. |
| Wrong domain in brand-runtime | Subdomain regex in `tenant-resolve.ts`, API URL in `portal.ts`, comments in `wrangler.toml` and source all reference `webwaka.ng` | **Correctness bug.** The subdomain pattern will never match `brand-{slug}.webwaka.com` requests. |
| Entitlement check on custom domain | No guard in any route checks whether the tenant's plan permits a custom domain. `evaluateCustomDomainRights()` does not exist. | **Security gap.** Any tenant can register a custom domain regardless of plan. |
| `custom_domain_status` column | Nowhere in the codebase is there a lifecycle status for custom domains. The middleware does a raw lookup with no status check — a pending/unverified hostname would resolve and serve content. | **Security gap + correctness bug.** |
| `webwaka.com` zone on Cloudflare | The account has **zero zones configured**. `infra/cloudflare/environments.md` explicitly states DNS is "NOT CONFIGURED — awaiting domain confirmation." CF for SaaS requires a proxied zone on this account. | **BLOCKER.** No custom hostnames are possible without this. |
| `brand-runtime-production` worker | Not deployed. Only staging exists on the account. | **BLOCKER** for production. |
| CI deploy for brand-runtime | Neither `deploy-staging.yml` nor `deploy-production.yml` deploys brand-runtime. Only `apps/api` is deployed in CI. | brand-runtime is deployed manually only. |

### 1.3 What Is Missing

- `tenant_branding` migration (table does not exist)
- `organizations.slug` migration (column does not exist)
- `custom_domain_status` column — lifecycle state: `none`, `pending`, `active`, `failed`, `revoked`
- `cf_hostname_id` column — Cloudflare custom hostname UUID (required to call CF API for status/delete)
- `cf_ownership_txt_name` / `cf_ownership_txt_value` — TXT pre-validation token surfaced to tenant
- API route for tenant to register/verify/delete a custom domain
- `evaluateCustomDomainRights()` + `requireCustomDomainRights()` in `packages/entitlements`
- CRON job to sync CF hostname status → D1 (`pending` → `active`/`failed`)
- `webwaka.com` zone added to Cloudflare account
- CF for SaaS enabled on that zone
- `brand.webwaka.com` fallback origin DNS record (AAAA `100::`, proxied)
- Worker route `*/*` on `webwaka.com` zone pointing to brand-runtime Worker
- CF API token with Custom Hostnames:Edit scope (for programmatic hostname management)
- Brand-runtime deploy step in CI

### 1.4 Unsafe Assumptions in Current Code

| Assumption | Location | Why It's Unsafe |
|---|---|---|
| `tenant_branding` table exists | `tenant-resolve.ts` L27, `theme.ts` L79 | Table does not exist — D1 throws at runtime |
| `organizations.slug` column exists | `theme.ts` L82 | Column does not exist — D1 throws at runtime |
| Any host in DB is a valid active custom domain | `tenant-resolve.ts` | No status check — a pending or failed CF hostname resolves and serves tenant content before SSL is provisioned |
| Subdomain format is `brand-{slug}.webwaka.ng` | `tenant-resolve.ts` L36 | Regex matches the wrong domain; all `webwaka.com` subdomain requests fall through to 404 |
| API URL in `portal.ts` is `api.webwaka.ng` | `portal.ts` L103 | Wrong domain — login POST will fail in production |

### 1.5 Must Confirm Before Implementation

1. **HUMAN ACTION REQUIRED:** Confirm `webwaka.com` nameservers are delegated to Cloudflare. The domain must be on Cloudflare DNS (orange cloud) for CF for SaaS to work. `infra/cloudflare/environments.md` shows this is pending.
2. **HUMAN ACTION REQUIRED:** Confirm which Cloudflare plan for `webwaka.com`. Free plan: 100 custom hostnames free, $0.10/month per additional. Pro/Business identical pricing, higher throughput.
3. Confirm desired CNAME target subdomain. Recommendation: `brand.webwaka.com` (a dedicated proxied subdomain as the fallback origin anchor — tenants CNAME to this).
4. Confirm custom domain plan gating: which subscription tiers allow custom domains? Recommendation: `pro`, `enterprise`, `partner`, `sub_partner` (i.e., `whiteLabelDepth >= 1`).

---

## 2. Target Design

### 2.1 Architecture Overview

```
Tenant DNS:           shop.acme.com  CNAME →  brand.webwaka.com
                                                    ↓
Cloudflare SaaS zone: webwaka.com  (CF for SaaS enabled)
Fallback origin:      brand.webwaka.com  →  AAAA 100:: (originless, proxied)
                                                    ↓
Worker route */*:     webwaka-brand-runtime-production
                                                    ↓
brand-runtime Worker: tenantResolve middleware
                      → D1: SELECT WHERE custom_domain = ? AND custom_domain_status = 'active'
                      → generateCssTokens(slug)
                      → render branded page with tenant theme
```

### 2.2 Full Tenant Custom Domain Onboarding Flow

```
Step 1 — Tenant submits domain in their WebWaka dashboard
  POST /api/workspaces/:workspaceId/custom-domain
  body: { domain: "shop.acme.com" }
  → Entitlement check: requireCustomDomainRights() — 403 if plan < pro
  → Validate domain format: valid FQDN, not *.anything, not webwaka.com, not workers.dev
  → Call CF for SaaS API:
      POST /zones/:CF_ZONE_ID/custom_hostnames
      { hostname: "shop.acme.com", ssl: { method: "txt", type: "dv",
        settings: { min_tls_version: "1.2" } } }
  → CF responds with:
      { id, hostname, status: "pending",
        ownership_verification: { type: "txt",
          name: "_cf-custom-hostname.shop.acme.com",
          value: "<token>" } }
  → Write to tenant_branding:
      custom_domain          = "shop.acme.com"
      custom_domain_status   = "pending"
      cf_hostname_id         = "<CF UUID>"
      cf_ownership_txt_name  = "_cf-custom-hostname.shop.acme.com"
      cf_ownership_txt_value = "<CF token>"
  → Return DNS instructions to tenant dashboard

Step 2 — Tenant adds DNS records at their registrar
  Record 1 (domain ownership verification — can be set first):
    TYPE:  TXT
    NAME:  _cf-custom-hostname.shop.acme.com
    VALUE: <cf_ownership_txt_value>

  Record 2 (routing — set when ready to go live):
    TYPE:  CNAME
    NAME:  shop.acme.com  (or www.shop.acme.com)
    VALUE: brand.webwaka.com

Step 3 — Cloudflare verifies ownership and issues SSL
  CF polls the TXT record → confirms domain ownership
  CF issues DV certificate (DigiCert or Let's Encrypt)
  Hostname status: pending → pending_validation → active
  SSL status:      initializing → pending_validation → active
  Typical time:    5–30 minutes after both DNS records propagate

Step 4 — CRON job syncs status (every 5 minutes)
  GET /zones/:CF_ZONE_ID/custom_hostnames/:cf_hostname_id
  If status = 'active' AND ssl.status = 'active':
    UPDATE tenant_branding SET custom_domain_status = 'active'
    DELETE THEME_CACHE KV key for this tenant slug
  If ssl.status = 'timed_out' (DCV failed after 7 days):
    UPDATE tenant_branding SET custom_domain_status = 'failed'

Step 5 — Traffic flows with full SSL
  shop.acme.com → CF edge → webwaka.com zone → Worker route */* → brand-runtime
  tenantResolve: custom_domain = 'shop.acme.com', status = 'active' → tenant_slug resolved
  → render branded page

Step 6 — SSL auto-renews
  Cloudflare manages full certificate lifecycle (90-day LE or annual DigiCert)
  No action required unless tenant removes their CNAME
```

### 2.3 DNS Requirements for Tenant

| Record type | Name | Value | Purpose |
|---|---|---|---|
| `TXT` | `_cf-custom-hostname.<their-domain>` | `<cf_ownership_txt_value>` | Domain ownership proof (can be removed after activation) |
| `CNAME` | `<their-domain>` | `brand.webwaka.com` | Route traffic through CF for SaaS |

**Apex domain note:** Standard CNAME records cannot be set at the apex (`acme.com` with no subdomain) by most registrars. CF Apex Proxying (Enterprise add-on) or requiring tenants to use `www.` / a subdomain is the correct approach for MVP. Document this limitation clearly in the tenant dashboard.

### 2.4 SSL Lifecycle States

| CF SSL status | Action |
|---|---|
| `initializing` | Show "Pending" in dashboard; no traffic yet |
| `pending_validation` | Show DNS instructions; DCV in progress |
| `active` | Set `custom_domain_status = 'active'`; traffic flows |
| `pending_expiration` | CF renewing automatically; no action needed |
| `expired` | CNAME was removed before renewal; set `custom_domain_status = 'failed'`; alert tenant |
| `timed_out` | DCV failed after 7-day backoff; set `failed`; tenant must re-add TXT record |

### 2.5 Fallback Behavior

When a request arrives on a host that matches `custom_domain` but `custom_domain_status != 'active'`:
- Return **HTTP 503** with a provisioning page: *"Your custom domain is being set up. In the meantime, use brand-{slug}.webwaka.com"*
- Do **not** fall through to subdomain/slug resolution — prevents leaking tenant identity from an unverified host
- The tenant's `brand-{slug}.webwaka.com` subdomain always works as a fallback while waiting

---

## 3. File-by-File Impact Map

### 3.1 New Migrations

**`infra/db/migrations/0190_tenant_branding.sql`** — NEW, code

```sql
-- Migration 0190 — tenant_branding table
-- Pillar 2: Branding / Website / Portal (brand-runtime Worker)
-- Stores per-tenant white-label config and custom domain lifecycle state.
-- Referenced by: apps/brand-runtime/src/lib/theme.ts
--                apps/brand-runtime/src/middleware/tenant-resolve.ts

CREATE TABLE IF NOT EXISTS tenant_branding (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL UNIQUE,       -- T3: one record per tenant
  tenant_slug            TEXT NOT NULL UNIQUE,       -- matches organizations.slug
  display_name           TEXT NOT NULL DEFAULT '',
  primary_color          TEXT,
  secondary_color        TEXT,
  accent_color           TEXT,
  font_family            TEXT,
  logo_url               TEXT,
  favicon_url            TEXT,
  border_radius_px       INTEGER,
  -- Custom domain fields
  custom_domain          TEXT UNIQUE,                -- e.g. "shop.acme.com"
  custom_domain_status   TEXT NOT NULL DEFAULT 'none'
                         CHECK (custom_domain_status IN
                           ('none','pending','active','failed','revoked')),
  cf_hostname_id         TEXT UNIQUE,                -- Cloudflare custom hostname UUID
  cf_ownership_txt_name  TEXT,                       -- "_cf-custom-hostname.shop.acme.com"
  cf_ownership_txt_value TEXT,                       -- CF-issued TXT validation token
  created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant_id
  ON tenant_branding(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_slug
  ON tenant_branding(tenant_slug);

-- Hot-path index: custom domain lookup on every brand-runtime request
CREATE INDEX IF NOT EXISTS idx_tenant_branding_custom_domain
  ON tenant_branding(custom_domain)
  WHERE custom_domain IS NOT NULL AND custom_domain_status = 'active';

-- CRON job index: polls pending domains for status sync
CREATE INDEX IF NOT EXISTS idx_tenant_branding_cf_hostname_id
  ON tenant_branding(cf_hostname_id)
  WHERE cf_hostname_id IS NOT NULL;
```

**`infra/db/migrations/0191_organizations_slug.sql`** — NEW, code

```sql
-- Migration 0191 — Add slug column to organizations
-- Required by apps/brand-runtime/src/lib/theme.ts (queries WHERE o.slug = ?)
-- The organizations table was created in 0002 without a slug column.

ALTER TABLE organizations ADD COLUMN slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug
  ON organizations(slug)
  WHERE slug IS NOT NULL;
```

---

### 3.2 `apps/brand-runtime/src/middleware/tenant-resolve.ts` — MODIFY, code

**Changes:**
1. Fix subdomain regex: `webwaka.ng` → `webwaka.com`
2. Add `custom_domain_status` to SELECT
3. Add status guard — `pending`/`failed` returns 503, not tenant content
4. Add `provisioningPage()` helper

```typescript
// Line 36 — BEFORE:
const subMatch = host.match(/^brand-([a-z0-9-]+)\.webwaka\.ng(?::\d+)?$/i);

// AFTER:
const subMatch = host.match(/^brand-([a-z0-9-]+)\.webwaka\.com(?::\d+)?$/i);

// Line 27 — BEFORE:
.prepare(`SELECT tenant_slug FROM tenant_branding WHERE custom_domain = ? LIMIT 1`)
.bind(host)
.first<{ tenant_slug: string }>();

// AFTER:
.prepare(
  `SELECT tenant_slug, custom_domain_status
   FROM tenant_branding WHERE custom_domain = ? LIMIT 1`
)
.bind(host)
.first<{ tenant_slug: string; custom_domain_status: string }>();

// After the DB call — ADD status guard:
if (customDomainRow) {
  if (customDomainRow.custom_domain_status !== 'active') {
    return c.html(provisioningPage(host), 503);
  }
  slug = customDomainRow.tenant_slug;
}

// ADD helper (bottom of file):
function provisioningPage(host: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <title>Domain Provisioning</title></head><body style="font-family:sans-serif;
    text-align:center;padding:4rem 1rem">
    <h1>Almost there</h1>
    <p>Your custom domain <strong>${escHtml(host)}</strong> is being set up.</p>
    <p>This usually takes 5–30 minutes after your DNS records propagate.</p>
    </body></html>`;
}
function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
```

---

### 3.3 `apps/brand-runtime/src/routes/portal.ts` — MODIFY, code

**Change:** Fix hardcoded API domain from `webwaka.ng` to `webwaka.com`.

```typescript
// Lines 103–105 — BEFORE:
? 'https://api.webwaka.ng'
: c.env.ENVIRONMENT === 'staging'
  ? 'https://api-staging.webwaka.ng'

// AFTER:
? 'https://api.webwaka.com'
: c.env.ENVIRONMENT === 'staging'
  ? 'https://api-staging.webwaka.com'
```

---

### 3.4 `apps/brand-runtime/src/templates/base.ts` — MODIFY, code

**Change:** Fix footer link domain.

```typescript
// Line 124 — BEFORE:
<p>Powered by <a href="https://webwaka.ng" ...>WebWaka</a></p>

// AFTER:
<p>Powered by <a href="https://webwaka.com" ...>WebWaka</a></p>
```

---

### 3.5 `apps/brand-runtime/wrangler.toml` — MODIFY, config

**Changes:**
1. Fix comment on line 4: `webwaka.ng` → `webwaka.com`
2. Add `APP_BASE_URL` vars for staging and production
3. Add Worker routes for `webwaka.com` zone (after zone is added to account)

```toml
# Line 4 — BEFORE:
# Routes: brand-*.webwaka.ng/* and custom domains (CNAME via Cloudflare for SaaS)

# AFTER:
# Routes: brand-*.webwaka.com/* and custom domains (CNAME via Cloudflare for SaaS)

# Add to [env.staging.vars]:
APP_BASE_URL = "https://api-staging.webwaka.com"

# Add to [env.production.vars]:
APP_BASE_URL = "https://api.webwaka.com"

# Add after zone is on account — [env.production.routes]:
[[env.production.routes]]
pattern = "brand.webwaka.com/*"
zone_name = "webwaka.com"

# Wildcard route catches all custom hostnames entering the zone:
[[env.production.routes]]
pattern = "*/*"
zone_name = "webwaka.com"

# Exclusion: API traffic must NOT go through brand-runtime:
# Add a second route in CF Dashboard with api.webwaka.com/* → No Worker
# (wrangler.toml does not support "no worker" routes; must be set in Dashboard)
```

> ⚠️ The `*/*` wildcard route will intercept **all** traffic entering the `webwaka.com` zone — including `api.webwaka.com`. You must add an exclusion route for `api.webwaka.com/*` with Worker = None in the CF Dashboard after deploy. More specific routes take precedence over wildcards.

---

### 3.6 `apps/ussd-gateway/wrangler.toml` — MODIFY, config

**Change:** Fix zone name and route patterns — they reference `webwaka.ng` but should be `webwaka.com`.

```toml
# BEFORE:
pattern = "api-staging.webwaka.ng/ussd"
zone_name = "webwaka.ng"
pattern = "api.webwaka.ng/ussd"
zone_name = "webwaka.ng"

# AFTER:
pattern = "api-staging.webwaka.com/ussd"
zone_name = "webwaka.com"
pattern = "api.webwaka.com/ussd"
zone_name = "webwaka.com"
```

---

### 3.7 `apps/public-discovery/wrangler.toml` — MODIFY, config

**Change:** Fix comment — references `webwaka.ng`.

```toml
# BEFORE:
# Routes: webwaka.ng/discover/* and webwaka.ng/near/* (no auth required)

# AFTER:
# Routes: webwaka.com/discover/* and webwaka.com/near/* (no auth required)
```

---

### 3.8 `apps/public-discovery/src/templates/base.ts` — MODIFY, code

```typescript
// BEFORE:
<link rel="icon" href="https://webwaka.ng/favicon.ico" />
<a href="https://webwaka.ng" ...>List your business →</a>

// AFTER:
<link rel="icon" href="https://webwaka.com/favicon.ico" />
<a href="https://webwaka.com" ...>List your business →</a>
```

---

### 3.9 `packages/entitlements/src/evaluate.ts` — MODIFY, code

Add `evaluateCustomDomainRights()`:

```typescript
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

### 3.10 `packages/entitlements/src/guards.ts` — MODIFY, code

```typescript
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

### 3.11 `packages/entitlements/src/index.ts` — MODIFY, code

```typescript
export { evaluateCustomDomainRights } from './evaluate.js';
export { requireCustomDomainRights } from './guards.js';
```

---

### 3.12 `apps/api/src/env.ts` — MODIFY, code

Add CF for SaaS bindings:

```typescript
// ADD:
/** webwaka.com Cloudflare Zone ID — for CF for SaaS custom hostname API calls */
CF_ZONE_ID: string;
/** CF API token with Custom Hostnames:Edit + Zone:Read on webwaka.com */
CF_FOR_SAAS_API_TOKEN: string;
```

---

### 3.13 `apps/api/src/routes/workspaces.ts` — MODIFY, code

Add three custom domain management routes. Each requires auth + workspace admin role + `requireCustomDomainRights()`.

**`POST /workspaces/:id/custom-domain`** — register domain with CF, write to D1
**`GET /workspaces/:id/custom-domain`** — return current status + DNS instructions
**`DELETE /workspaces/:id/custom-domain`** — remove from CF + clear D1 row

Key implementation notes:
- Validate domain with regex: valid FQDN, no wildcards, not `webwaka.com`, not `workers.dev`, not `webwaka.workers.dev`
- Check `UNIQUE` constraint violation → 409 Conflict if domain already registered by another tenant
- On `DELETE`: call `DELETE /zones/:CF_ZONE_ID/custom_hostnames/:cf_hostname_id` first, then clear D1 row; invalidate THEME_CACHE KV

---

### 3.14 `apps/api/src/jobs/cf-hostname-status-sync.ts` — NEW, code

CRON job that syncs CF hostname status into D1. Runs every 5 minutes via the `scheduled()` handler.

```typescript
// Logic:
// 1. SELECT id, cf_hostname_id, tenant_slug FROM tenant_branding
//    WHERE custom_domain_status = 'pending' AND cf_hostname_id IS NOT NULL
// 2. For each: GET /zones/:CF_ZONE_ID/custom_hostnames/:cf_hostname_id
// 3. If result.status === 'active' AND result.ssl.status === 'active':
//    UPDATE tenant_branding SET custom_domain_status = 'active', updated_at = unixepoch()
//    await env.THEME_CACHE.delete(`theme:${tenant_slug}`)
// 4. If result.ssl.status === 'timed_out' OR result.status === 'blocked':
//    UPDATE tenant_branding SET custom_domain_status = 'failed', updated_at = unixepoch()
// 5. Log results; errors are non-fatal (retry next cycle)
```

Wire into `apps/api/src/index.ts` `scheduled()` handler alongside negotiation-expiry.

---

### 3.15 `apps/api/wrangler.toml` — MODIFY, config

Add new secrets comment and `CF_ZONE_ID` var:

```toml
# Add to [env.staging.vars]:
CF_ZONE_ID = "<webwaka.com staging zone ID>"

# Add to [env.production.vars]:
CF_ZONE_ID = "<webwaka.com production zone ID>"

# Add to secrets comment block:
#   CF_FOR_SAAS_API_TOKEN   — CF API token: Zone:Read + SSL and Certificates:Edit on webwaka.com
```

---

### 3.16 CI — `deploy-staging.yml` + `deploy-production.yml` — MODIFY, config

Add `deploy-brand-runtime` job to both workflows, parallel with `deploy-api-*`, depending on `migrate-*` completing:

```yaml
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
    - name: Deploy brand-runtime
      run: |
        if [ -f "apps/brand-runtime/wrangler.toml" ]; then
          npx wrangler deploy --env production \
            --config apps/brand-runtime/wrangler.toml
        fi
      env:
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

### 3.17 Tests — NEW

`apps/brand-runtime/src/middleware/tenant-resolve.test.ts` (see Section 6).
`apps/api/src/routes/workspaces.test.ts` extensions (see Section 6).
`apps/api/src/jobs/cf-hostname-status-sync.test.ts` (see Section 6).

---

### 3.18 `infra/cloudflare/environments.md` — MODIFY, docs

Update DNS section to reflect `webwaka.com` confirmed, add CF for SaaS setup status, and list the `brand.webwaka.com` fallback origin entry once created.

---

## 4. Implementation Sequence

Strictly ordered. Do not skip steps.

### Step 1 — Cloudflare account setup (ALL HUMAN ACTIONS — blocks everything)

**HUMAN ACTION REQUIRED — 1a:** Add `webwaka.com` zone to Cloudflare account (`a5f5864b726209519e0c361f2bb90e79`).
- Dashboard → Add a site → `webwaka.com`
- Choose Free plan minimum (pricing for custom hostnames is same across plans)
- Update nameservers at your registrar to the two CF NS records provided
- Wait for NS propagation (10 minutes to 1 hour typically)
- Note the **Zone ID** shown in Dashboard → `webwaka.com` → Overview (right sidebar)

**HUMAN ACTION REQUIRED — 1b:** Enable Cloudflare for SaaS on the `webwaka.com` zone.
- Dashboard → `webwaka.com` → SSL/TLS → Custom Hostnames
- Click **Enable Cloudflare for SaaS**
- Free tier: 100 custom hostnames/month free, $0.10/month per additional

**HUMAN ACTION REQUIRED — 1c:** Create the fallback origin DNS record.
- Dashboard → `webwaka.com` → DNS → Add record:
  - Type: `AAAA`
  - Name: `brand`  (creates `brand.webwaka.com`)
  - IPv6: `100::`  (reserved, originless — CF handles routing)
  - Proxy status: **Proxied** (orange cloud — **required**)
- This is the CNAME target tenants will point their domains to

**HUMAN ACTION REQUIRED — 1d:** Set the fallback origin.
- Dashboard → `webwaka.com` → SSL/TLS → Custom Hostnames → Fallback Origin
- Enter: `brand.webwaka.com`
- Save

**HUMAN ACTION REQUIRED — 1e:** Create a scoped CF API token.
- Dashboard → My Profile → API Tokens → Create Token → Custom Token
- Permissions: Zone → `webwaka.com` → **SSL and Certificates: Edit**, **Zone: Read**
- Copy the token value
- Add as Wrangler secret (both staging and production):
  ```bash
  wrangler secret put CF_FOR_SAAS_API_TOKEN --env staging --config apps/api/wrangler.toml
  wrangler secret put CF_FOR_SAAS_API_TOKEN --env production --config apps/api/wrangler.toml
  ```

**HUMAN ACTION REQUIRED — 1f:** After brand-runtime deploy (Step 6), add the exclusion Worker route in CF Dashboard.
- Dashboard → `webwaka.com` → Workers Routes → Add route
- Route: `api.webwaka.com/*` → Worker: **(none)**
- This prevents the brand-runtime `*/*` wildcard from intercepting API Worker traffic

---

### Step 2 — Domain corrections across codebase (code)

Fix all `webwaka.ng` references in brand-runtime and related files before any other code changes. This is a prerequisite for correct local dev and staging validation.

Files to fix:
- `apps/brand-runtime/src/middleware/tenant-resolve.ts` — subdomain regex
- `apps/brand-runtime/src/routes/portal.ts` — API base URL
- `apps/brand-runtime/src/templates/base.ts` — footer link
- `apps/brand-runtime/wrangler.toml` — comment on line 4
- `apps/ussd-gateway/wrangler.toml` — zone_name and route patterns
- `apps/public-discovery/wrangler.toml` — comment
- `apps/public-discovery/src/templates/base.ts` — favicon and footer link

Commit: `fix: correct webwaka.ng → webwaka.com across brand-runtime, ussd-gateway, public-discovery`

---

### Step 3 — Database migrations (code + deploy to staging)

Create migrations `0190_tenant_branding.sql` and `0191_organizations_slug.sql`.

Apply to staging D1:
```bash
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --file infra/db/migrations/0190_tenant_branding.sql
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --file infra/db/migrations/0191_organizations_slug.sql

# Verify:
npx wrangler d1 execute webwaka-os-staging --env staging --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tenant_branding');"
```

---

### Step 4 — Entitlements package (code)

In `packages/entitlements/`:
1. Add `evaluateCustomDomainRights()` to `evaluate.ts`
2. Add `requireCustomDomainRights()` to `guards.ts`
3. Export from `index.ts`

Run: `pnpm --filter @webwaka/entitlements test` — all existing tests must still pass.

---

### Step 5 — brand-runtime middleware + template fixes (code)

1. Apply changes in `tenant-resolve.ts` (domain fix + status guard + provisioning page)
2. Apply `portal.ts` API URL fix
3. Apply `base.ts` footer domain fix
4. Run: `pnpm --filter @webwaka/brand-runtime typecheck`

---

### Step 6 — API custom domain routes + CRON job (code)

1. Add `CF_ZONE_ID` and `CF_FOR_SAAS_API_TOKEN` to `apps/api/src/env.ts`
2. Add `POST/GET/DELETE /workspaces/:id/custom-domain` to `workspaces.ts`
3. Create `apps/api/src/jobs/cf-hostname-status-sync.ts`
4. Wire CRON job into `apps/api/src/index.ts` `scheduled()` handler
5. Add `CF_ZONE_ID` to `apps/api/wrangler.toml` vars

Run: `pnpm --filter api typecheck`

---

### Step 7 — Write and pass all tests (code)

Write tests from Section 6. Run: `pnpm test --filter @webwaka/brand-runtime @webwaka/api @webwaka/entitlements`

---

### Step 8 — Deploy secrets + wrangler.toml routes (config)

After Step 1 zone setup:
1. Run `wrangler secret put CF_FOR_SAAS_API_TOKEN` for staging and production
2. Add `CF_ZONE_ID` to `wrangler.toml` vars
3. Add Worker route patterns to `apps/brand-runtime/wrangler.toml`

---

### Step 9 — Staging deploy and end-to-end validation

```bash
# Deploy brand-runtime to staging
npx wrangler deploy --env staging --config apps/brand-runtime/wrangler.toml

# Deploy API to staging (picks up new routes + CRON)
npx wrangler deploy --env staging --config apps/api/wrangler.toml
```

**HUMAN ACTION REQUIRED:** Using a test domain you own, run through the full onboarding flow:
1. `POST /workspaces/:id/custom-domain` with your test domain
2. Add the TXT + CNAME records at your registrar
3. Wait for CF to activate (check dashboard or poll `GET /workspaces/:id/custom-domain`)
4. Verify: `https://<your-test-domain>/` serves tenant branded page with valid HTTPS
5. Verify: `brand-<slug>.webwaka.com` subdomain still works
6. Verify: `DELETE /workspaces/:id/custom-domain` removes the CF hostname and clears D1 row

---

### Step 10 — Production deploy

1. Apply migrations to production D1
2. Merge to `main` → CI deploys API + brand-runtime (after CI jobs added in Step 8)
3. **HUMAN ACTION REQUIRED:** Verify `*/*` Worker route is active on `webwaka.com` in CF dashboard
4. **HUMAN ACTION REQUIRED:** Add `api.webwaka.com/*` → No Worker exclusion route (Step 1f)
5. Monitor Workers dashboard error rates for 30 minutes post-deploy

---

## 5. Security and Tenancy Concerns

### 5.1 Domain Ownership Verification

CF for SaaS issues a unique TXT record token per custom hostname. The tenant must add `_cf-custom-hostname.<domain>` to their authoritative DNS. CF polls this and only activates the hostname — and issues an SSL certificate — after the token is verified.

WebWaka never marks `custom_domain_status = 'active'` manually. Status is set by the CRON job only after CF confirms `status === 'active' AND ssl.status === 'active'`. This creates a double gate: CF verifies ownership; WebWaka only activates after CF confirms.

### 5.2 Tenant Isolation

- `custom_domain UNIQUE` constraint in `tenant_branding` — one tenant per domain, enforced at DB level
- `tenantResolve` middleware reads `custom_domain_status = 'active'` — inactive domains serve the provisioning page, never another tenant's content
- `cf.req.header('host')` on Cloudflare Workers reflects the verified incoming hostname, not a client-controlled header — safe to use for routing

### 5.3 Host Header Trust Boundaries

On Cloudflare Workers, the `host` header is set by the CF edge and reflects the actual hostname of the incoming request. It cannot be spoofed by the end client. The current code's use of `c.req.header('host')` is correct.

**Never use** `X-Forwarded-Host` or `X-Original-Host` for tenant resolution — these are client-controlled. No code in brand-runtime currently does this; this constraint must hold in future changes.

### 5.4 Phishing and Domain Takeover Prevention

| Scenario | Prevention |
|---|---|
| Tenant registers a domain they don't own | CF TXT ownership verification blocks activation. Domain stays `pending` indefinitely without the TXT record. |
| Two tenants claiming the same domain | `UNIQUE` constraint on `tenant_branding.custom_domain` — second registration gets a 409 Conflict |
| Tenant removes CNAME after activation | CF detects loss of DNS → marks hostname `moved_or_deleted` → CRON job sets `custom_domain_status = 'failed'` → provisioning page served |
| Wildcard domain registration | Domain validation regex in the API route rejects any value containing `*` |
| Tenant registering a `webwaka.com` subdomain | Validation rejects any domain that ends in `webwaka.com` or `workers.dev` |
| Admin row manipulation | `requireCustomDomainRights()` enforces plan gating at the API layer; direct DB manipulation is a separate threat model |

### 5.5 Certificate Provisioning Failure Handling

CF uses a backoff schedule for DCV: retries at 1 min, 5 min, 30 min, 4 hours, 24 hours intervals. After 7 days without successful DCV, `ssl.status` becomes `timed_out`. The CRON job detects this and sets `custom_domain_status = 'failed'`. The tenant must then delete and re-add their domain (resets the CF hostname, issues new TXT token) to retry.

Surface to tenant: "Domain verification timed out. Please remove and re-add your custom domain to try again."

---

## 6. Test Plan

### `apps/brand-runtime/src/middleware/tenant-resolve.test.ts` (new)

```typescript
describe('tenantResolve middleware', () => {
  // T1: active custom domain resolves to correct tenant slug
  test('resolves active custom domain → tenant slug');

  // T2: pending custom domain returns 503 provisioning page (NOT tenant content)
  test('pending custom domain → 503 with provisioning message');

  // T3: failed custom domain returns 503
  test('failed custom domain → 503');

  // T4: unknown host (no DB row) returns 404
  test('unknown host → 404');

  // T5: brand-{slug}.webwaka.com subdomain resolves correctly
  test('brand-acme.webwaka.com → tenantSlug = acme');

  // T6: brand-{slug}.webwaka.ng does NOT match (wrong domain)
  test('brand-acme.webwaka.ng → falls through to slug param or 404');

  // T7: route param :slug fallback resolves correctly
  test('/:slug path param → tenantSlug resolved');

  // T8: X-Forwarded-Host is not used for resolution
  test('X-Forwarded-Host header ignored; only host header used');

  // T9: webwaka.com hosts skip custom_domain DB lookup (optimization)
  test('brand-*.webwaka.com does not trigger custom_domain query');
});
```

### `apps/api/src/routes/workspaces.test.ts` extensions

```typescript
describe('POST /workspaces/:id/custom-domain', () => {
  // T10: free plan tenant → 403 Forbidden
  // T11: starter plan tenant → 403 Forbidden
  // T12: pro plan tenant → 200, pending status, CF API called
  // T13: wildcard domain → 400 validation error
  // T14: webwaka.com domain → 400 validation error
  // T15: workers.dev domain → 400 validation error
  // T16: duplicate domain (owned by another tenant) → 409 Conflict
  // T17: D1 row created with status = 'pending', cf_hostname_id populated
});

describe('DELETE /workspaces/:id/custom-domain', () => {
  // T18: calls CF API DELETE /custom_hostnames/:cf_hostname_id
  // T19: sets custom_domain_status = 'revoked' in D1
  // T20: deletes THEME_CACHE KV key for tenant slug
  // T21: idempotent if no custom domain registered → 404
});

describe('GET /workspaces/:id/custom-domain', () => {
  // T22: pending → returns DNS instructions (TXT name + value, CNAME target)
  // T23: active → returns status active, no DNS instructions needed
  // T24: none → 404
});
```

### `apps/api/src/jobs/cf-hostname-status-sync.test.ts` (new)

```typescript
describe('cf-hostname-status-sync', () => {
  // T25: pending → active when CF returns status=active, ssl.status=active
  // T26: does not re-process already-active rows
  // T27: pending → failed when CF ssl.status=timed_out
  // T28: deletes THEME_CACHE KV on active transition
  // T29: CF API error is caught, logged, does not crash the CRON job
  // T30: processes multiple pending rows in one CRON execution
});
```

### `packages/entitlements/src/evaluate.test.ts` extensions

```typescript
describe('evaluateCustomDomainRights', () => {
  // T31: free → denied
  // T32: starter → denied
  // T33: pro → allowed
  // T34: enterprise → allowed
  // T35: inactive subscription → denied regardless of plan
});
```

---

## 7. Rollout Plan

### 7.1 Staging Validation (before any production changes)

1. Apply migrations 0190 + 0191 to staging D1
2. Deploy brand-runtime-staging + API-staging
3. Use a test domain you own for end-to-end validation (Step 9 above)
4. All tests from Section 6 must pass
5. Manually verify: HTTPS valid on test domain, tenant content rendered, subdomain fallback working

### 7.2 Production Rollout

1. Complete all Cloudflare account setup steps (Step 1) — these are non-disruptive to existing Workers
2. Apply migrations to production D1 (additive — zero downtime, no risk to existing data)
3. Deploy API to production (new routes + CRON — additive, no breaking changes)
4. Deploy brand-runtime-production (new Worker — currently only staging exists)
5. **HUMAN ACTION REQUIRED:** Verify `*/*` Worker route + `api.webwaka.com/*` exclusion route in CF dashboard
6. Enable custom domain UI in tenant dashboard (the API routes are live; enable the UI feature toggle)

### 7.3 Tenant-by-Tenant Enablement

Plan gating via `requireCustomDomainRights()` handles this automatically. Only Pro and above tenants can register a custom domain. No manual per-tenant enablement required.

Optional: add `custom_domain_enabled BOOLEAN DEFAULT 0` to `tenant_branding` for emergency per-tenant kill switch without changing subscription plan.

### 7.4 Rollback Strategy

| What breaks | Rollback |
|---|---|
| brand-runtime Worker regression | `wrangler rollback --env production --config apps/brand-runtime/wrangler.toml` — previous version restored in <1 min; custom domain tenants briefly see provisioning page |
| API custom-domain routes regression | `wrangler rollback --env production --config apps/api/wrangler.toml` — tenants cannot register/delete domains but existing active domains continue serving |
| Migration 0190/0191 regression | Both are additive (new table, new column). Drop `tenant_branding` table and `slug` column on staging only if needed. Production rollback is safe — no existing queries depend on these additions. |
| CF for SaaS misconfiguration | Remove `*/*` Worker route in CF Dashboard → custom hostname traffic stops reaching brand-runtime; no impact on `api.webwaka.com` (already excluded) |

### 7.5 Monitoring

After launch:
1. **Custom hostname pending queue** — `SELECT COUNT(*) FROM tenant_branding WHERE custom_domain_status = 'pending'`; alert if any row is pending > 24 hours
2. **brand-runtime error rate** — CF Workers dashboard → brand-runtime-production → error %: alert on >1% 5xx
3. **CRON sync execution** — log entry per run; alert on 3 consecutive failures
4. **THEME_CACHE KV hit rate** — high miss rate = cache invalidation working but DB latency increasing
5. **Custom domain activation time** — log time from `custom_domain_status = 'pending'` to `active`; P95 should be <60 minutes

---

## 8. Final Recommendation

**Proceed with this plan as written.**

**Five hard truths from the code review:**

1. **The feature is entirely non-functional today.** `tenant_branding` table doesn't exist, `organizations.slug` doesn't exist, and the subdomain regex targets the wrong domain. Zero custom domain requests can resolve at runtime. The scaffolding gives the impression the feature exists — it does not.

2. **The single gate to everything is the Cloudflare zone.** The account has zero zones. Step 1 must happen before any code shipped actually does anything with CF for SaaS. This is a 30-minute human task, not a code task.

3. **The domain correction (`.ng` → `.com`) is a prerequisite, not an afterthought.** It should be committed first, separately, so the rest of the feature work builds on a correct foundation.

4. **CF for SaaS is the right choice.** The platform runs entirely on Cloudflare Workers. CF for SaaS is the native, zero-operational-overhead path to SSL management for tenant custom domains. The Worker-as-fallback-origin pattern with `*/*` route is officially documented, community-validated, and correct for this architecture.

5. **Estimated effort:** ~3 engineering days for code (Steps 2–8) + ~1–2 hours for Cloudflare account setup (Step 1 human actions). The code tasks are clearly scoped with no hidden complexity once the DB migrations are applied and the zone exists.

---

*End of plan — WebWaka OS brand-runtime Custom Domain & SSL — 2026-04-14*
