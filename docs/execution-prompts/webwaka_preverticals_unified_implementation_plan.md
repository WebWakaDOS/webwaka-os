# WebWaka OS — Unified Pre-Verticals Implementation Plan

**Document type:** Master agent execution plan — supersedes all prior pre-verticals documents  
**Scope:** 3-in-1 platform alignment + Pillar 2/3 app scaffolding + SuperAgent core infrastructure + NDPR consent gate  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Status:** Authoritative — replaces `webwaka_preverticals_execution_prompts.md`  
**Supersedes:** `webwaka_preverticals_execution_prompts.md` (SA-only plan); all scattered M8-AI phase plan fragments  

> **This document is the single source of truth for all pre-verticals work.**  
> No vertical implementation (M8a+) may begin until Phase 0, Phase 1, and Phase 2 are complete.  
> Phases 1 and 2 may run in parallel. Phase 3 follows Phase 2.

---

## Platform Context

WebWaka is a **3-in-1 platform** with three primary product pillars:

| Pillar | What it does | Key apps | Status |
|--------|-------------|----------|--------|
| **Pillar 1 — Operations-Management (POS)** | Back-office, transactions, inventory, reporting | `apps/api`, `apps/platform-admin`, `apps/partner-admin`, `apps/ussd-gateway` | ✅ Live |
| **Pillar 2 — Branding / Website / Portal** | Branded digital presence, single-vendor store | `apps/brand-runtime` | ❌ Not implemented |
| **Pillar 3 — Listing / Multi-Vendor Marketplace** | Discovery, claim-first, geography-powered search | `apps/public-discovery` | ❌ Not implemented |
| **SuperAgent (cross-cutting AI)** | Intelligence layer serving all 3 pillars — NOT a 4th pillar | `packages/superagent` | 🔲 Pre-verticals work |

**The purpose of this pre-verticals plan is to complete all three pillars and make the AI layer production-ready before M8a verticals begin.**

---

## Execution Sequencing

```
PHASE 0: 3-in-1 Alignment Foundation           [run first — blocks everything]
  PV-0.1  Documentation drift fixes (done ✅)
  PV-0.2  primary_pillars schema + seed (done ✅ migration 0037)
  PV-0.3  [Pillar N] prefix in all package.json descriptions
  PV-0.4  GitHub labels for 3-in-1 pillars
  PV-0.5  Apply pillar labels to 7 existing execution prompt docs

                    ↓ (unblocks both Phase 1 and Phase 2)

PHASE 1: Pillar 2 + 3 Scaffolding             [parallel with Phase 2]
  PV-1.1  Scaffold apps/brand-runtime/ (Pillar 2 MVP)
  PV-1.2  Scaffold apps/public-discovery/ (Pillar 3 MVP)
  PV-1.3  Wire packages/white-label-theming to brand-runtime

PHASE 2: SuperAgent Core Infrastructure        [parallel with Phase 1]
  SA-1.1  Expand AIProvider union + capability types
  SA-1.2  AI routing engine (5-level resolution chain)
  SA-1.3  Provider adapters (openai-compat, anthropic, google)
  SA-1.4  SuperAgent key service + migration 0042
  SA-1.5  WakaCU wallet service + migration 0043
  SA-1.6  Partner credit pool system + migration 0044
  SA-1.7  Credit burn engine (per-request cost metering)
  SA-1.8  Auth hooks for AI-enabled users
  SA-1.9  Usage metering, observability, AI audit log + migration 0045

                    ↓ (Phase 2 must complete before Phase 3)

PHASE 3: SuperAgent Advanced Features          [follows Phase 2]
  SA-2.0  NDPR AI consent gate (grant/withdraw/check)
  SA-2.1  [Reserved — HITL queue + autonomy enforcement]
  SA-2.2  [Reserved — Workspace AI settings per-vertical]
```

---

## General Rules for All Agents

- **Never make assumptions.** Always read referenced documents and code first.
- **Research deeply before executing.** Do online research on domain-specific patterns before designing.
- **Thoroughness beats speed.** Do not rush implementation at the cost of correctness.
- **All work pushed to GitHub.** No important local work remains outside the repo. Every task ends with a PR.
- **TypeScript strict mode throughout.** Cloudflare Workers + Hono + D1 + TypeScript strict. No `any` escapes, no `// @ts-ignore`, no silent fallbacks.
- **Platform Invariants are non-negotiable.** Read `docs/governance/platform-invariants.md` before any implementation. Key invariants:
  - P2: No duplication — use shared packages
  - P9: Integer kobo (integer WakaCU credits for AI billing)
  - P10: NDPR consent gate before any AI call
  - P12: No AI on USSD sessions — ever
  - P13: No raw PII to any AI provider
  - T3: Tenant isolation — all D1 queries include `WHERE tenant_id = ?`
  - T4: Typed errors — never throw untyped or string errors
- **3-in-1 alignment:** Every PR must be labeled with the correct `3in1:*` GitHub label. SuperAgent is the AI layer — it is NOT a fourth pillar.

---

## PHASE 0: 3-in-1 Alignment Foundation

> **Gate:** All Phase 0 tasks must be complete before M8a begins. Phase 0 tasks PV-0.1 and PV-0.2 are already complete.

---

### TASK PV-0.1: Fix All Documentation Drift

- **Status:** ✅ COMPLETE (2026-04-09)
- **What was done:**
  - `docs/governance/vision-and-mission.md` — corrected pillar order and naming (DOC-1)
  - `ARCHITECTURE.md` — added 3-in-1 pillar table and pillar declaration rule (DOC-2)
  - `docs/governance/3in1-platform-architecture.md` — created canonical pillar reference doc (DOC-8)
  - `docs/governance/verticals-master-plan.md` — added pillar column to P1 table + 3-in-1 classification section (DOC-3)
  - `docs/governance/superagent/01-synthesis-report.md` through `06-governance-rules.md` — added 3-in-1 position statement to all 6 AI governance docs (DOC-6)
  - `docs/execution-prompts/MASTER_CONTINUATION_PROMPT.md` — added `primary_pillars` to task block template + 3in1 reference to context foundation (DOC-5)
- **Evidence:** Commit at current HEAD on `main`

---

### TASK PV-0.2: Add primary_pillars to Verticals Schema and Seed

- **Status:** ✅ COMPLETE (2026-04-09)
- **What was done:**
  - Migration `infra/db/migrations/0037_verticals_primary_pillars.sql` — `ALTER TABLE verticals ADD COLUMN primary_pillars TEXT NOT NULL DEFAULT '["ops","marketplace"]'`
  - Default populates correctly for all verticals; authoritative overrides applied for all 17 P1 verticals and major P2 commerce verticals
  - Migration must be applied to staging and production D1 databases before running verticals
- **Migration number:** 0037 (next after 0036_verticals_table.sql)

---

### TASK PV-0.3: Apply [Pillar N] Prefix to All package.json Descriptions

- **Status:** 🔲 PENDING
- **Module:** All packages under `packages/`
- **GitHub context:**
  - 3-in-1 platform architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/3in1-platform-architecture.md
  - Package list: https://github.com/WebWakaDOS/webwaka-os/tree/main/packages/

---

You are an expert **Senior Platform Engineer** with deep knowledge of monorepo governance, working on WebWaka OS.

**1. Mandatory context reading:**
- `docs/governance/3in1-platform-architecture.md` — Section 4 "Module-to-Pillar Assignment" — the authoritative pillar assignment for every package

**2. Implementation workflow:**

Branch: `feat/pv-0-pillar-prefixes` from `main`.

For every `package.json` file under `packages/`, update the `"description"` field to begin with the correct prefix:
- `[Pillar 1]` — ops-management packages (pos, offerings, workspaces, payments)
- `[Pillar 2]` — branding packages (white-label-theming, design-system, frontend)
- `[Pillar 3]` — marketplace packages (profiles, search-indexing, claims, geography, verticals)
- `[AI]` — SuperAgent/AI packages (ai-abstraction, ai-adapters, superagent)
- `[Infra]` — shared infrastructure (auth, auth-tenancy, entities, entitlements, identity, otp, contact, offline-sync, shared-config, relationships, community, social, politics)

Example: `"description": "[Pillar 3] Vertical registration framework, FSM engine, and lifecycle management for WebWaka OS"`

**3. QA:**
- Every `package.json` under `packages/` has a description beginning with `[Pillar N]`, `[AI]`, or `[Infra]`
- Run `grep -r '"description"' packages/*/package.json` to verify all are prefixed

**4. Finalize and push:**
- Commit: `chore(packages): add [Pillar N] prefixes to all package descriptions (PV-0.3)`
- PR references: `docs/governance/3in1-platform-architecture.md` Section 4

---

### TASK PV-0.4: Create GitHub Labels for 3-in-1 Pillars

- **Status:** 🔲 PENDING
- **Type:** Manual task (via GitHub UI or GitHub CLI)
- **GitHub context:**
  - Repo: https://github.com/WebWakaDOS/webwaka-os

---

**Create the following labels in the WebWakaDOS/webwaka-os repository:**

| Label name | Color (hex) | Description |
|---|---|---|
| `3in1:pillar-1-ops` | `#0075ca` | Operations-Management (POS) — Pillar 1 |
| `3in1:pillar-2-branding` | `#e4e669` | Branding / Website / Portal — Pillar 2 |
| `3in1:pillar-3-marketplace` | `#d93f0b` | Listing / Multi-Vendor Marketplace — Pillar 3 |
| `3in1:superagent` | `#7057ff` | Cross-cutting AI layer (SuperAgent — not a 4th pillar) |
| `3in1:infra` | `#cfd3d7` | Pre-vertical infrastructure (auth, entities, etc.) |

**Using GitHub CLI:**
```bash
gh label create "3in1:pillar-1-ops" --color "0075ca" --description "Operations-Management (POS) — Pillar 1" --repo WebWakaDOS/webwaka-os
gh label create "3in1:pillar-2-branding" --color "e4e669" --description "Branding / Website / Portal — Pillar 2" --repo WebWakaDOS/webwaka-os
gh label create "3in1:pillar-3-marketplace" --color "d93f0b" --description "Listing / Multi-Vendor Marketplace — Pillar 3" --repo WebWakaDOS/webwaka-os
gh label create "3in1:superagent" --color "7057ff" --description "Cross-cutting AI layer (SuperAgent — not a 4th pillar)" --repo WebWakaDOS/webwaka-os
gh label create "3in1:infra" --color "cfd3d7" --description "Pre-vertical infrastructure (auth, entities, etc.)" --repo WebWakaDOS/webwaka-os
```

**After creating labels:** Apply `3in1:infra` to all existing merged PRs for auth, entities, payments, and geography work. Apply `3in1:pillar-1-ops` to all POS, agent-network, and USSD PRs.

---

### TASK PV-0.5: Apply Pillar Labels to All 7 Existing Execution Prompt Docs

- **Status:** 🔲 PENDING
- **Module:** `docs/execution-prompts/`
- **Files to update:**
  1. `webwaka_verticals_commerce_pos_execution_prompts.md`
  2. `webwaka_verticals_civic_government_execution_prompts.md`
  3. `webwaka_verticals_transport_logistics_execution_prompts.md`
  4. `webwaka_verticals_health_education_execution_prompts.md`
  5. `webwaka_verticals_creator_professional_financial_execution_prompts.md`
  6. `webwaka_verticals_agricultural_place_execution_prompts.md`
  7. `webwaka_verticals_civic_government_execution_prompts.md` (check all 7)

---

You are an expert **Senior Platform Engineer and Technical Writer**, working on WebWaka OS.

**1. Mandatory context reading:**
- `docs/governance/3in1-platform-architecture.md` — Section 5 "Vertical Pillar Classification"
- `docs/governance/verticals-master-plan.md` — Pillar column in P1 table and 3-in-1 classification table

**2. Implementation workflow:**

Branch: `feat/pv-0-pillar-labels-execution-prompts` from `main`.

For each of the 7 existing execution prompt documents:

a) Add a `- **Primary pillars:**` field to every existing `## TASK V-*` block, using the pillar classification from `docs/governance/verticals-master-plan.md` and `docs/governance/3in1-platform-architecture.md`.

b) Add a 3-in-1 position statement directly below the document header:
```markdown
> **3-in-1 Platform Note:**  
> Every vertical in this document serves at least Pillar 1 (Ops) and Pillar 3 (Marketplace).  
> Verticals marked with Pillar 2 also require `apps/brand-runtime/` (implemented in PV-1.1).  
> SuperAgent AI is cross-cutting — not a fourth pillar.  
> See `docs/governance/3in1-platform-architecture.md`.
```

c) Add `3in1-platform-architecture.md` to the GitHub context links in each task block.

**3. QA:**
- Every task block has a `- **Primary pillars:**` field
- The 3-in-1 position statement appears in each document header
- Pillar assignments match `docs/governance/3in1-platform-architecture.md` and `verticals-master-plan.md`

**4. Finalize and push:**
- Commit: `docs(verticals): add pillar labels to all 7 existing execution prompt docs (PV-0.5)`

---

## PHASE 1: Pillar 2 + 3 Application Scaffolding

> **Gate:** Phase 0 must be complete. Phase 1 runs in parallel with Phase 2 (SA-1.x).  
> **Critical:** Both PV-1.1 and PV-1.2 must ship before M8b begins any vertical that uses Pillar 2 or Pillar 3.

---

### TASK PV-1.1: Scaffold apps/brand-runtime/ (Pillar 2 MVP)

- **Primary pillar:** Pillar 2 — Branding / Website / Portal
- **Status:** 🔲 PENDING — `apps/brand-runtime/` is currently empty (`.gitkeep` only)
- **Module:** `apps/brand-runtime/` (new Cloudflare Worker)
- **Milestone:** M8a (must ship before M8b)
- **GitHub context:**
  - 3-in-1 platform architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/3in1-platform-architecture.md
  - White-label theming package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/white-label-theming/
  - Design system: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/design-system/
  - Frontend package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/frontend/
  - Existing API wiring pattern: https://github.com/WebWakaDOS/webwaka-os/blob/main/apps/api/src/index.ts
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md

---

You are an expert **Senior Full-Stack Engineer** specializing in Cloudflare Workers edge rendering and white-label SaaS platforms, working on WebWaka OS.

**Skills required:**
- Cloudflare Workers + Hono SSR patterns (no Node.js built-ins)
- Multi-tenant subdomain routing (`{tenant-slug}.webwaka.ng` → resolve tenant config from KV)
- White-label theming — CSS custom properties, per-tenant brand tokens from `packages/white-label-theming/`
- Static asset serving from Workers (inline HTML, CSS, or R2 bucket)
- TypeScript strict mode + Workers runtime types

**1. Mandatory context reading (100% before execution):**

- `docs/governance/3in1-platform-architecture.md` — Section 2 (pillar 2 description) and Section 4 (brand-runtime role)
- `ARCHITECTURE.md` — Pillar 2 section and monorepo layout
- `packages/white-label-theming/` — existing theming primitives, token schema, brand config type
- `packages/design-system/` — existing UI components available for use
- `packages/frontend/` — any existing frontend helpers, i18n
- `apps/api/src/index.ts` — how existing Workers apps are structured (use same pattern)
- `docs/governance/platform-invariants.md` — T3 (tenant isolation), P2 (no duplication)
- `docs/governance/entitlement-model.md` — which plan tiers unlock Pillar 2 (Branding) features

**2. Online research and execution plan:**

- Research: Cloudflare Workers SSR patterns for multi-tenant SaaS (how to resolve tenant from hostname)
- Research: edge-rendered branded microsites — how Shopify, Webflow, and Squarespace serve multi-tenant storefronts at the edge
- Research: CSS custom properties as a theming mechanism for multi-tenant apps

Execution plan must cover:
- **Objective:** A Workers app that resolves a tenant from the subdomain (`{slug}.webwaka.ng`) or custom domain (KV lookup), loads their brand config from `packages/white-label-theming/`, and renders an HTML page with correct colours, fonts, logo, and content.
- **MVP pages to implement (Phase 1 — enough to validate architecture):**
  1. Home page — entity name, description, hero image, primary CTA
  2. Offerings page — list of products/services from the entity's offerings (fetched from API)
  3. Contact/About page — address, phone, social links
  4. 404 page — branded

**3. Implementation workflow:**

Branch: `feat/pv-1-brand-runtime` from `main`.

**File structure to create in `apps/brand-runtime/`:**
```
apps/brand-runtime/
  src/
    index.ts            — Hono Worker entry point
    middleware/
      tenant-resolve.ts — resolve tenant from hostname → load brand config from KV
      pillar-gate.ts    — verify tenant has Pillar 2 entitlement (check plan tier)
    routes/
      home.ts           — GET / — hero page
      offerings.ts      — GET /offerings — product/service list
      contact.ts        — GET /contact — contact/about page
      not-found.ts      — 404 handler
    templates/
      base.ts           — base HTML shell with CSS custom property injection
      home.ts           — home page template
      offerings.ts      — offerings template
    types.ts            — BrandRuntimeEnv, TenantBrandConfig
  package.json
  tsconfig.json
  wrangler.toml         — Workers config (routes: *.webwaka.ng/*, custom domains)
```

**Tenant resolution flow:**
1. Extract hostname from request: `brand.webwaka.ng` → slug = `brand`
2. Look up tenant config from KV: `BRAND_KV.get('tenant:brand')` → `TenantBrandConfig`
3. If not found → 404 (not a registered WebWaka tenant)
4. Check `tenantConfig.pillar2Active` — if false → redirect to `app.webwaka.ng/upgrade` with message
5. Inject brand tokens into base HTML template via CSS custom properties
6. Render page with tenant-specific content fetched from API

**TenantBrandConfig (stored in KV):**
```typescript
type TenantBrandConfig = {
  tenantId: string;
  slug: string;
  displayName: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor: string;       // hex
  secondaryColor: string;     // hex
  fontFamily: string;         // Google Fonts name or system stack
  pillar2Active: boolean;     // Pillar 2 entitlement gate
  apiBaseUrl: string;         // WebWaka API for fetching offerings
  customDomain?: string;
  socialLinks: { platform: string; url: string }[];
}
```

All tenant data lookups: zero cross-tenant leakage (T3). Never render another tenant's content.

**4. QA and verification:**

Write `apps/brand-runtime/src/brand-runtime.test.ts`:
- Home page renders with correct tenant name and brand colors
- Offering list renders from mocked API response
- Unknown hostname returns 404 (not a WebWaka tenant)
- Tenant without Pillar 2 entitlement redirects to upgrade page
- T3: requests for tenant A cannot access tenant B's brand config
- CSS custom properties injected correctly for primary/secondary colors
- At least 10 test cases

**5. Finalize and push:**
- Commit: `feat(brand-runtime): Pillar 2 branded website runtime — MVP (PV-1.1)`
- PR label: `3in1:pillar-2-branding`
- PR references: `docs/governance/3in1-platform-architecture.md`, `packages/white-label-theming/`

---

### TASK PV-1.2: Scaffold apps/public-discovery/ (Pillar 3 Marketplace Frontend MVP)

- **Primary pillar:** Pillar 3 — Listing / Multi-Vendor Marketplace
- **Status:** 🔲 PENDING — `apps/public-discovery/` is currently empty (`.gitkeep` only)
- **Module:** `apps/public-discovery/` (new Cloudflare Worker)
- **Milestone:** M8a (must ship before M8b)
- **GitHub context:**
  - 3-in-1 platform architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/3in1-platform-architecture.md
  - Search-indexing package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/search-indexing/
  - Profiles package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/profiles/
  - Geography package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/geography/
  - Claims package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/claims/
  - Verticals seed: https://github.com/WebWakaDOS/webwaka-os/blob/main/infra/db/seeds/0004_verticals-master.csv

---

You are an expert **Senior Full-Stack Engineer** specializing in geospatial discovery platforms, multi-tenant marketplace architecture, and Africa-market search UX, working on WebWaka OS.

**Skills required:**
- Cloudflare Workers + Hono SSR patterns
- Geography-first discovery UX — Nigerian LGA/ward hierarchy routing
- Faceted search and vertical-specific filtering
- Multi-tenant profile rendering — seeded vs. claimed entity display
- Nigeria-specific discovery patterns (Jumia, Chowdeck, Zowasel, VConnect style UX)

**1. Mandatory context reading (100% before execution):**

- `docs/governance/3in1-platform-architecture.md` — Pillar 3 description, public-discovery role
- `packages/search-indexing/` — faceted search API, vertical category filters, geography scoping
- `packages/profiles/` — entity profile schema (seeded vs. claimed, public fields)
- `packages/geography/` — place hierarchy (state → LGA → ward → facility), ancestry queries
- `packages/claims/` — claim state machine, verification flow
- `infra/db/seeds/0004_verticals-master.csv` — all 160 vertical slugs and categories for filter options
- `docs/governance/platform-invariants.md` — T3 (profiles only show tenant-permitted public data)

**2. Online research and execution plan:**

- Research: how Foursquare, Yelp, Jumia Food, VConnect, and Google Business Profile serve discovery at the African SME level
- Research: geography-first URL patterns for African city directories (`/lagos/motor-park`, `/abuja/clinic`)
- Research: Cloudflare Workers + D1 patterns for fast public listing pages without a React SPA
- Research: SEO-optimized discovery pages for Nigerian SMEs

Execution plan must cover:
- **Objective:** A Workers app serving geography-first discovery for all 160 WebWaka verticals. URLs like `GET /lagos/motor-park` serve a listing of motor parks in Lagos. `GET /lagos/motor-park/{id}` serves a public profile.
- **MVP pages:**
  1. Home / category browse — vertical categories with counts
  2. Geography + vertical listing — `/lagos/motor-park` → paginated list of seeded/claimed entities
  3. Public profile page — `/lagos/motor-park/oshodi-terminals` → rich entity profile
  4. Search — keyword + location filter → matching entities

**3. Implementation workflow:**

Branch: `feat/pv-1-public-discovery` from `main`.

**File structure:**
```
apps/public-discovery/
  src/
    index.ts                 — Hono Worker entry point
    middleware/
      geo-context.ts         — Resolve state/LGA from URL path segment
    routes/
      home.ts                — GET / — category browse with counts
      listing.ts             — GET /:state/:vertical — paginated listing
      profile.ts             — GET /:state/:vertical/:slug — public profile
      search.ts              — GET /search?q=&location= — full-text search
      sitemap.ts             — GET /sitemap.xml — for SEO
    templates/
      base.ts                — base HTML shell
      home.ts
      listing.ts
      profile.ts
    types.ts                 — DiscoveryEnv, PublicEntityProfile
  package.json
  tsconfig.json
  wrangler.toml
```

**URL routing pattern:**
- `GET /` — home: 14 category tiles with entity counts
- `GET /:state/:vertical` — e.g. `/lagos/motor-park` → motor parks in Lagos (paginated, sortable)
- `GET /:state/:vertical/:slug` — public entity profile
- `GET /search` — cross-vertical, geography-aware search
- `GET /claim/:vertical/:id` — CTA redirecting to `app.webwaka.ng/claim/{id}` (starts the claim flow)

**Public profile display rules:**
- Seeded (unclaimed) entities: show display_name, category, geography, and a "Claim this listing" CTA
- Claimed entities: show all public profile fields from `packages/profiles/`; link to their brand site if Pillar 2 is active
- No tenant PII exposed — only the public profile surface from `packages/profiles/`

**4. QA and verification:**

- Home page renders 14 category tiles with correct entity counts
- `/lagos/motor-park` returns motor parks in Lagos only (geography scoped)
- `/lagos/motor-park/{slug}` renders public profile with correct entity data
- Seeded entity shows "Claim this listing" CTA; claimed entity shows full profile
- Search results filtered by location and category
- Sitemap.xml returns valid XML with correct URLs
- No cross-tenant or PII data in public responses
- At least 12 test cases

**5. Finalize and push:**
- Commit: `feat(public-discovery): Pillar 3 marketplace frontend — MVP (PV-1.2)`
- PR label: `3in1:pillar-3-marketplace`
- PR references: `docs/governance/3in1-platform-architecture.md`, geography package

---

### TASK PV-1.3: Wire packages/white-label-theming to apps/brand-runtime/

- **Primary pillar:** Pillar 2 — Branding / Website / Portal
- **Status:** 🔲 PENDING — `packages/white-label-theming/` exists but is not wired to any surface app
- **Depends on:** PV-1.1 (brand-runtime scaffolded)
- **Module:** `packages/white-label-theming/` + `apps/brand-runtime/`
- **Milestone:** M8a (immediately after PV-1.1)

---

You are an expert **Senior Frontend Platform Engineer** specializing in design token systems and white-label SaaS platforms, working on WebWaka OS.

**1. Mandatory context reading:**
- `packages/white-label-theming/` — all existing types, token definitions, and brand config schema
- `apps/brand-runtime/src/types.ts` — `TenantBrandConfig` (from PV-1.1)
- `packages/design-system/` — shared component tokens

**2. Implementation workflow:**

Branch: `feat/pv-1-theming-wire` from `main` (or stack on PV-1.1 branch).

The goal is to fully integrate `packages/white-label-theming/` into `apps/brand-runtime/`:

1. Ensure `packages/white-label-theming/` exports a `BrandConfig` type that maps to `TenantBrandConfig` in `apps/brand-runtime/`
2. Create a `generateCssTokens(brandConfig: BrandConfig): string` function in `packages/white-label-theming/` that produces a CSS `:root { }` block with custom properties
3. Wire it into the `base.ts` template in `apps/brand-runtime/` — inject the CSS token string into the `<style>` tag at render time
4. Validate that changing `primaryColor` in the brand config changes the rendered CSS output
5. Ensure `packages/white-label-theming/` has a correct `package.json` description starting with `[Pillar 2]`

**3. QA:**
- `generateCssTokens()` produces a valid CSS `:root` block
- Changing `primaryColor` in brand config changes `--color-primary` in rendered output
- Brand-runtime renders correct fonts, colors, and logo from `TenantBrandConfig`
- At least 6 test cases

**4. Finalize and push:**
- Commit: `feat(white-label-theming): wire CSS token generation to brand-runtime (PV-1.3)`
- PR label: `3in1:pillar-2-branding`

---

## PHASE 2: SuperAgent Core Infrastructure (SA-1.x)

> **Gate:** Phase 0 must be complete. Phase 2 runs in parallel with Phase 1 (Pillar 2/3 scaffolding).  
> **Execution order within Phase 2:** SA-1.1 → SA-1.2 (depends on SA-1.1) → SA-1.3 (parallel with SA-1.2) → SA-1.4, SA-1.5, SA-1.6 (can stack) → SA-1.7 (depends on SA-1.5) → SA-1.8 (depends on SA-1.2) → SA-1.9 (depends on SA-1.4, SA-1.5).

> **SuperAgent reminder:** SuperAgent is the cross-cutting AI layer — NOT a fourth pillar. All AI capabilities are exposed through Pillar 1 (Ops dashboard), Pillar 2 (brand-runtime AI-assisted content), or Pillar 3 (marketplace ranking/enrichment). No standalone AI product page.

---

### TASK SA-1.1: Expand AI Provider Union Type and Capability Types

- **Primary pillar:** Cross-cutting (AI) — serves all 3 pillars
- **Module:** `packages/ai-abstraction`
- **Roadmap ref:** SA-1.1, SA-1.2 — SuperAgent Phase 1
- **GitHub context:**
  - Types: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/ai-abstraction/src/types.ts
  - Index: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/ai-abstraction/src/index.ts
  - ADL: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-architecture-decision-log.md
  - Synthesis: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/01-synthesis-report.md
  - Architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/03-system-architecture.md
  - Provider routing: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-provider-routing.md
  - Capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md

---

You are an expert **Senior TypeScript Platform Engineer** specializing in AI infrastructure and provider-neutral type systems, working on WebWaka OS.

**Skills required:**
- TypeScript strict mode — discriminated unions, branded types, type narrowing
- AI provider API contracts (OpenAI-compatible, Anthropic, Google Vertex)
- Cloudflare Workers runtime constraints (no Node.js built-ins)
- WebWaka platform architecture — entitlements, BYOK, credit-based billing

**1. Mandatory context reading:**

Read and fully internalize ALL of the following before writing a single line of code:
- `packages/ai-abstraction/src/types.ts` — existing `AIProvider`, `AIAdapter`, `AIRequest`, `AIResponse` types
- `packages/ai-abstraction/src/index.ts` — current exports
- `docs/governance/superagent/01-synthesis-report.md` — section 2 (what already exists) and section 3 (gap analysis)
- `docs/governance/superagent/03-system-architecture.md` — section on type contracts
- `docs/governance/ai-architecture-decision-log.md` — ADL-001 (provider union), ADL-003 (aiRights gate)
- `docs/governance/ai-capability-matrix.md` — full capability list per tier
- `docs/governance/ai-provider-routing.md` — aggregator selection logic
- `docs/governance/platform-invariants.md` — P10 (NDPR consent), P12 (no AI on USSD)

**2. Online research and execution plan:**

- Research: extensible provider union types in TypeScript (discriminated union vs. string literal union)
- Research: capability-gating patterns in AI gateway services (OpenRouter, Together, Eden AI)
- Execution plan: expand `AIProvider`, add `AICapabilityType`, `AICapabilitySet`, `evaluateAICapability()`

**3. Implementation workflow:**

Branch: `feat/sa-1-ai-abstraction-types` from `main`.

Implement in `packages/ai-abstraction/src/`:

1. **Expand `AIProvider` union** in `types.ts`:
   - Add aggregator-routable: `openrouter`, `together`, `groq`, `eden`, `fireworks`, `deepinfra`, `perplexity`, `cohere`, `mistral`, `deepseek`, `qwen`, `yi`, `gemini_via_agg`, `claude_via_agg`, `gpt_via_agg`
   - Add `byok_custom` for BYOK escape hatch
   - Retain `openai`, `anthropic`, `google` for direct BYOK paths (ADL-010)
   - Additive only — never remove existing provider IDs

2. **Create `capabilities.ts`:**
   - `AICapabilityType` union: `text_generation | summarization | classification | translation | embedding | image_generation | image_understanding | stt | tts | web_search | agent_run | automation_run`
   - `evaluateAICapability(cap: AICapabilityType, entitlement: PlanConfig): boolean`
   - `USSD_EXCLUDED_CAPABILITIES: readonly AICapabilityType[]` — all capabilities (P12)

3. Update `index.ts` to export all new types

**4. QA:**

Write `packages/ai-abstraction/src/capabilities.test.ts`:
- `evaluateAICapability` returns false for all capabilities when `aiRights: false`
- `evaluateAICapability` returns false for agent/automation on Growth tier
- `USSD_EXCLUDED_CAPABILITIES` covers all types (P12)
- At least 8 test cases

**5. Finalize and push:**
- Commit: `feat(ai-abstraction): expand AIProvider union + add AICapabilityType/Set (SA-1.1)`
- PR label: `3in1:superagent`
- PR references: ADL-001, ADL-003, capability matrix

---

### TASK SA-1.2: Build SuperAgent AI Routing Engine

- **Primary pillar:** Cross-cutting (AI)
- **Module:** `packages/ai-abstraction` — new `router.ts`
- **Depends on:** SA-1.1 complete
- **Roadmap ref:** SA-1.3
- **GitHub context:**
  - Types (SA-1.1): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/ai-abstraction/src/types.ts
  - ADL: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-architecture-decision-log.md
  - Provider routing: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-provider-routing.md
  - System architecture: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/superagent/03-system-architecture.md

---

You are an expert **Senior Backend Platform Engineer** specializing in AI gateway routing systems, working on WebWaka OS.

**1. Mandatory context reading:**
- `docs/governance/ai-provider-routing.md` — the 5-level resolution chain
- `docs/governance/superagent/03-system-architecture.md` — routing engine design
- `docs/governance/ai-architecture-decision-log.md` — ADL-001, ADL-002, ADL-009, ADL-010
- `docs/governance/platform-invariants.md` — P10 (NDPR consent), P12 (USSD exclusion), P13

**2. Research:**
- How OpenRouter, Together AI, and Eden AI implement routing and fallback
- Secure API key resolution patterns in multi-tenant SaaS

**3. Implementation — create `packages/ai-abstraction/src/router.ts`:**

1. **`RoutingContext` type:** `userId`, `tenantId`, `workspaceId`, `userByokKey?`, `workspaceByokKey?`, `superagentKey?`, `capability: AICapabilityType`, `isUssdSession: boolean`, `hasNdprConsent: boolean`, `entitlement: PlanConfig`

2. **`resolveAdapter(ctx: RoutingContext, env: Env): Promise<AIAdapter>`** — 5-level chain:
   - Level 0: `ctx.isUssdSession` → `AIRoutingError('USSD_EXCLUDED')` (P12)
   - Level 0: `!ctx.hasNdprConsent` → `AIRoutingError('CONSENT_REQUIRED')` (P10)
   - Level 1: `ctx.userByokKey` → return BYOK adapter
   - Level 2: `ctx.workspaceByokKey` → return workspace BYOK adapter
   - Level 3: SuperAgent key in KV → managed adapter with aggregator selection
   - Level 4: platform fallback aggregator key (`PLATFORM_AGG_KEY` env var)
   - Level 5: `AIRoutingError('NO_ADAPTER_AVAILABLE')`

3. **`selectAggregator(capability, env): AggregatorConfig`** — OpenRouter as primary; Together/Groq as fallback

4. **`AIRoutingError`** class with typed error codes

**4. QA — at least 10 test cases covering:**
- USSD session → `USSD_EXCLUDED`
- No consent → `CONSENT_REQUIRED`
- User BYOK → user BYOK adapter returned
- No keys → `NO_ADAPTER_AVAILABLE`
- Correct aggregator selected for capability type

**5. Finalize and push:**
- Commit: `feat(ai-abstraction): 5-level AI routing engine (SA-1.2)`
- PR label: `3in1:superagent`
- PR references: ADL-002, ADL-009, ADL-010, ai-provider-routing.md

---

### TASK SA-1.3: Build Provider Adapters (OpenAI-compat, Anthropic, Google)

- **Primary pillar:** Cross-cutting (AI)
- **Module:** `packages/ai-adapters` (new package)
- **Depends on:** SA-1.1 complete
- **Roadmap ref:** SA-1.4, SA-1.5, SA-1.6

---

Create new package `packages/ai-adapters/` with `package.json`, `tsconfig.json`, `vitest.config.ts`.

**`src/openai-compat.ts`** — serves OpenRouter, Together, Groq, Eden, Fireworks, DeepInfra, Perplexity and any OpenAI-compatible endpoint:
- `complete(req: AIRequest): Promise<AIResponse>` — POST to `{baseUrl}/v1/chat/completions`
- `embed(req: AIEmbedRequest): Promise<AIEmbedResponse>` — POST to `{baseUrl}/v1/embeddings`
- HTTP errors → `AIAdapterError` with typed codes; 28s timeout (Workers 30s CPU limit)

**`src/anthropic.ts`** — native Anthropic Messages API (BYOK-only, ADL-010):
- POST to `https://api.anthropic.com/v1/messages`; `anthropic-version: 2023-06-01` header required

**`src/google.ts`** — native Google Gemini REST (BYOK-only, ADL-010):
- POST to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`

All adapters: zero `any`, full JSDoc, no `console.log` in production paths.

**4. QA — at least 12 test cases across adapters:**
- openai-compat: success → mapped `AIResponse`; HTTP 429 → `RATE_LIMITED`; HTTP 401 → `INVALID_KEY`; timeout → `TIMEOUT`
- anthropic: success → `AIResponse`; format mismatch → typed error
- google: success → `AIResponse`

**5. Finalize and push:**
- Commit: `feat(ai-adapters): openai-compat + anthropic + google adapters (SA-1.3)`
- PR label: `3in1:superagent`
- Add `@webwaka/ai-adapters` to root `pnpm-workspace.yaml`

---

### TASK SA-1.4: SuperAgent Key Service — Issuance, Storage, and Validation

- **Primary pillar:** Cross-cutting (AI)
- **Module:** `packages/superagent` (new), migration `0042_superagent_keys.sql`, route `apps/api/src/routes/superagent-keys.ts`
- **Roadmap ref:** SA-1.7

---

**Migration `infra/db/migrations/0042_superagent_keys.sql`:**
```sql
CREATE TABLE superagent_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  model_tier TEXT NOT NULL DEFAULT 'standard' CHECK (model_tier IN ('standard', 'premium', 'ultra')),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER,
  revocation_reason TEXT
);
CREATE INDEX idx_sk_tenant ON superagent_keys (tenant_id, status);
CREATE INDEX idx_sk_workspace ON superagent_keys (workspace_id, status);
CREATE INDEX idx_sk_hash ON superagent_keys (key_hash);
```

**`packages/superagent/src/key-service.ts`:**
- Key format: `sk-waka-{32 random hex}`
- `issueKey(ctx, env)` — generates key, stores SHA-256 hash in D1, encrypted value in `SA_KEY_KV`
- `validateKey(rawKey, env)` — hashes input, looks up D1, returns record if active
- `revokeKey(keyId, ctx, env)` — sets `status: 'revoked'` in D1, deletes from KV
- `listKeys(workspaceId, env)` — metadata only, never raw key

**Routes `apps/api/src/routes/superagent-keys.ts`:**
- `POST /superagent/keys` — requires auth + KYC tier Growth+; returns raw key ONCE only
- `GET /superagent/keys` — list metadata
- `DELETE /superagent/keys/:id` — revoke

Update `apps/api/src/env.ts` to add `SA_KEY_KV: KVNamespace`.

**4. QA — at least 10 test cases:** Key format, validate correct/wrong/revoked, T3 isolation, raw key never in D1.

**5. Commit:** `feat(superagent): key issuance, validation, revocation — migration 0042 (SA-1.4)`  
**PR label:** `3in1:superagent`

---

### TASK SA-1.5: WakaCU Wallet Service — Credit Wallets and Transactions

- **Primary pillar:** Cross-cutting (AI)
- **Module:** `packages/superagent` + migration `0043_wc_wallets.sql`
- **Roadmap ref:** SA-1.8

---

**Migration `infra/db/migrations/0043_wc_wallets.sql`:**
```sql
CREATE TABLE wc_wallets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  balance_wc INTEGER NOT NULL DEFAULT 0 CHECK (balance_wc >= 0),
  trial_balance_wc INTEGER NOT NULL DEFAULT 0 CHECK (trial_balance_wc >= 0),
  total_credited_wc INTEGER NOT NULL DEFAULT 0,
  total_burned_wc INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_wc_wallet_workspace ON wc_wallets (workspace_id);
CREATE INDEX idx_wc_wallet_tenant ON wc_wallets (tenant_id);

CREATE TABLE wc_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wc_wallets(id),
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'trial_credit', 'trial_debit', 'refund', 'adjustment')),
  amount_wc INTEGER NOT NULL CHECK (amount_wc > 0),
  balance_after_wc INTEGER NOT NULL CHECK (balance_after_wc >= 0),
  reference TEXT,
  description TEXT NOT NULL,
  ai_capability TEXT,
  request_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_wc_txn_wallet ON wc_transactions (wallet_id, created_at DESC);
CREATE INDEX idx_wc_txn_tenant ON wc_transactions (tenant_id, created_at DESC);
```

**`packages/superagent/src/wallet-service.ts`:**
- `getOrCreateWallet(workspaceId, tenantId, env)`
- `burnCredits(walletId, amountWc, meta, env)` — atomic debit, `InsufficientCreditsError` if zero; trial credits burned first
- `creditWallet(walletId, amountWc, type, ref, env)`
- `getBalance(workspaceId, env)` — `{ balanceWc, trialBalanceWc }`
- `getTransactionHistory(workspaceId, env, opts?)` — paginated

WakaCU pricing: ₦1.50/WC retail; ₦1.00/WC bulk; ₦0.60/WC wholesale. Integer-only (P9).

**4. QA — at least 10 test cases:** Burn success/fail, trial-first burn, top-up, T3, integer enforcement.

**5. Commit:** `feat(superagent): WakaCU wallet + transaction ledger — migration 0043 (SA-1.5)`  
**PR label:** `3in1:superagent`

---

### TASK SA-1.6: Partner Credit Pool System

- **Primary pillar:** Cross-cutting (AI)
- **Module:** `packages/superagent` + migration `0044_partner_credit_pools.sql`
- **Depends on:** SA-1.5 complete
- **Roadmap ref:** SA-1.9

---

**Migration `infra/db/migrations/0044_partner_credit_pools.sql`:**
```sql
CREATE TABLE partner_credit_pools (
  id TEXT PRIMARY KEY,
  partner_tenant_id TEXT NOT NULL,
  total_wc INTEGER NOT NULL DEFAULT 0 CHECK (total_wc >= 0),
  allocated_wc INTEGER NOT NULL DEFAULT 0 CHECK (allocated_wc >= 0),
  available_wc INTEGER GENERATED ALWAYS AS (total_wc - allocated_wc) VIRTUAL,
  price_per_wc_kobo INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_pool_partner ON partner_credit_pools (partner_tenant_id);

CREATE TABLE partner_credit_allocations (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES partner_credit_pools(id),
  partner_tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  amount_wc INTEGER NOT NULL CHECK (amount_wc > 0),
  reference TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_alloc_pool ON partner_credit_allocations (pool_id, created_at DESC);
CREATE INDEX idx_alloc_workspace ON partner_credit_allocations (workspace_id);
```

**`packages/superagent/src/partner-pool-service.ts`:**
- `allocateFromPool(poolId, workspaceId, amountWc, env)` — atomic: deduct from pool, credit workspace wallet
- `getPoolBalance(partnerTenantId, env)`
- `topUpPool(partnerTenantId, amountWc, ref, env)`

**4. QA — at least 8 test cases:** Atomic transfer, insufficient balance, T3 (no cross-tenant allocation).

**5. Commit:** `feat(superagent): partner credit pool system — migration 0044 (SA-1.6)`  
**PR label:** `3in1:superagent`

---

### TASK SA-1.7: Credit Burn Engine — Per-Request AI Cost Metering

- **Primary pillar:** Cross-cutting (AI)
- **Module:** `packages/superagent/src/credit-burn.ts`
- **Depends on:** SA-1.5 complete

---

**`packages/superagent/src/credit-burn.ts`:**
- `estimateCost(capability: AICapabilityType, inputTokens: number, model: string): number` — WC cost estimate (~1 WC per 500 tokens; see billing doc)
- `reserveCredits(walletId, estimated, env): Promise<string>` — returns reservation ID
- `finalizeBurn(reservationId, actual, env): Promise<void>` — burns actual, releases excess
- `burnAndRecord(req, walletId, cap, env): Promise<BurnRecord>` — estimate → reserve → call AI → finalize

**BYOK bypass:** Routing engine levels 1–2 (BYOK adapters) → skip wallet debit, log `billing_mode: 'byok'`.

**Spend cap enforcement:** Check `entitlements.monthlyWcCap` before reserving; throw `SpendCapExceededError` if over limit.

**4. QA — at least 10 test cases:** Correct cost, correct debit, BYOK bypass, spend cap, insufficient balance propagation.

**5. Commit:** `feat(superagent): credit burn engine with reservation pattern (SA-1.7)`  
**PR label:** `3in1:superagent`

---

### TASK SA-1.8: Auth Hooks for AI-Enabled Users

- **Primary pillar:** Cross-cutting (AI + Infra)
- **Module:** `packages/auth/src/ai-hooks.ts`, `apps/api/src/middleware/ai-auth.ts`
- **Depends on:** SA-1.2 complete

---

**`packages/auth/src/ai-hooks.ts`:**
- `requireAiRights` — Hono middleware; reads `aiRights` from entitlement; returns 403 if false
- `requireNdprConsent(purpose: string)` — Hono middleware; queries D1 `consent_records`; returns 403 `CONSENT_REQUIRED` if none
- `resolveByokKey` — checks `X-BYOK-Key` header, then user KV, then workspace KV; sets `c.set('byokKey', ...)` or null

**`apps/api/src/middleware/ai-auth.ts`:**
- Compose `requireAuth` → `requireAiRights` → `requireNdprConsent('ai_usage')` into `aiAuthMiddleware`
- Attach `RoutingContext` partial to Hono context

Export new guards from `packages/auth/src/index.ts`.

**4. QA — at least 8 test cases:** `aiRights: false` blocks, no consent blocks, BYOK from header, BYOK from KV, USSD blocked.

**5. Commit:** `feat(auth): AI auth hooks — requireAiRights, requireNdprConsent, resolveByokKey (SA-1.8)`  
**PR label:** `3in1:superagent`

---

### TASK SA-1.9: Usage Metering, Observability, and AI Audit Logging

- **Primary pillar:** Cross-cutting (AI)
- **Module:** `packages/superagent/src/usage-meter.ts`, `apps/api/src/routes/superagent-usage.ts`
- **Depends on:** SA-1.4, SA-1.5 complete

---

**Migration (create `infra/db/migrations/0045_ai_usage_events.sql`):**
```sql
CREATE TABLE ai_usage_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id_hash TEXT NOT NULL,
  capability TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  billing_mode TEXT NOT NULL CHECK (billing_mode IN ('managed', 'byok', 'trial')),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_wc INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'rate_limited', 'consent_blocked')),
  error_code TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_aue_workspace ON ai_usage_events (workspace_id, created_at DESC);
CREATE INDEX idx_aue_tenant ON ai_usage_events (tenant_id, created_at DESC);
```

**`packages/superagent/src/usage-meter.ts`:**
- `recordUsageEvent(event, env)` — non-blocking insert via `ctx.waitUntil` (Workers pattern); never stores raw userId (hash only, P13)
- `getUsageSummary(workspaceId, period, env)` — aggregate tokens, cost, request count
- `exportUsageLog(workspaceId, from, to, env)` — for NDPR/CBN compliance export

**`apps/api/src/routes/superagent-usage.ts`:**
- `GET /superagent/usage?period=month` — workspace admin
- `GET /superagent/usage/export?from=&to=` — workspace admin

**4. QA — at least 10 test cases:** Correct fields stored, no raw userId, T3 scope, date range filtering, `consent_blocked` status recorded.

**5. Commit:** `feat(superagent): AI usage metering and audit log — migration 0045 (SA-1.9)`  
**PR label:** `3in1:superagent`

---

## PHASE 3: SuperAgent Advanced Features (SA-2.x)

> **Gate:** Phase 2 (all SA-1.x tasks) must be complete and merged to `main` before Phase 3 begins.

---

### TASK SA-2.0: NDPR AI Consent Gate — AI-Specific Consent Records

- **Primary pillar:** Cross-cutting (AI + Infra)
- **Module:** `packages/contact/src/consent.ts` (extend), `apps/api/src/routes/consent.ts`
- **Roadmap ref:** SA-2.x — SuperAgent Phase 2
- **Depends on:** SA-1.8 complete

---

You are an expert **Senior Backend Engineer and Privacy Engineer**, working on WebWaka OS.

**1. Mandatory context reading:**
- `infra/db/migrations/0017_consent_records.sql` — existing consent table schema
- `docs/governance/ai-provider-routing.md` — NDPR consent gate (P10)
- `docs/governance/platform-invariants.md` — P10 (NDPR consent gate), P12 (USSD exclusion)
- `docs/qa/ndpr-consent-audit.md` — auditor expectations
- `packages/contact/src/` — existing contact service patterns

**2. Research:**
- NDPR 2023 guidelines on AI-specific consent (purpose limitation, retention)
- GDPR Article 6 lawful basis mapping to NDPR equivalent

**3. Implementation:**

Branch: `feat/sa-2-ndpr-consent` from `main`.

Extend `consent_records` (new migration after 0045):
- `purpose TEXT NOT NULL DEFAULT 'general'` — add `ai_usage` as valid purpose
- `withdrawn_at INTEGER` — withdrawal timestamp (soft-mark, never DELETE)

**`packages/contact/src/consent.ts`** (extend):
- `grantAiConsent(userId, tenantId, env): Promise<void>`
- `withdrawAiConsent(userId, tenantId, env): Promise<void>`
- `hasAiConsent(userId, tenantId, env): Promise<boolean>` — used by SA-1.8 middleware

**`apps/api/src/routes/consent.ts`:**
- `POST /consent/ai` — grant
- `DELETE /consent/ai` — withdraw
- `GET /consent/ai` — status

**4. QA — at least 8 test cases:** Grant creates record; withdraw soft-marks; `hasAiConsent` false after withdrawal; no re-enable without explicit grant; AI middleware blocked on withdrawn consent; USSD sessions never granted AI consent (P12).

**5. Commit:** `feat(consent): NDPR AI consent gate — grant/withdraw/check (SA-2.0)`  
**PR label:** `3in1:superagent`  
**PR references:** Platform invariant P10, NDPR audit doc

---

### TASK SA-2.1: HITL Queue and Autonomy Enforcement Middleware (Reserved)

- **Status:** 🔲 RESERVED — detailed task block to be written at Phase 3 planning time
- **Primary pillar:** Cross-cutting (AI)
- **Summary:** Implement the Human-in-the-Loop (HITL) review queue for high-stakes AI outputs; enforce autonomy levels (L1–L4) from `docs/governance/superagent/06-governance-rules.md`
- **Depends on:** SA-1.8, SA-2.0 complete

---

### TASK SA-2.2: Workspace AI Settings Per-Vertical (Reserved)

- **Status:** 🔲 RESERVED — detailed task block to be written at Phase 3 planning time
- **Primary pillar:** Cross-cutting (AI)
- **Summary:** Per-workspace AI configuration — enable/disable capabilities per vertical, set autonomy thresholds, manage per-vertical BYOK keys, configure AI advisory display preferences
- **Depends on:** SA-1.4, SA-2.0 complete

---

## Migration Number Registry

> **This registry is authoritative. No migration may be created without a number from this registry.**  
> Check `infra/db/migrations/` before creating any new migration and use the next unused sequential number.

| Migration | File | Contents | Status |
|-----------|------|----------|--------|
| 0035 | `0035_contact_telegram_chat_id.sql` | Contact Telegram chat ID | ✅ Applied |
| 0036 | `0036_verticals_table.sql` | Verticals table + 160 seeds | ✅ Applied |
| **0037** | `0037_verticals_primary_pillars.sql` | `primary_pillars` column | ✅ Created (apply to D1) |
| 0038–0041 | (reserved — available for M8a infra work) | — | 🔲 Available |
| **0042** | `0042_superagent_keys.sql` | `superagent_keys` table | 🔲 SA-1.4 |
| **0043** | `0043_wc_wallets.sql` | `wc_wallets` + `wc_transactions` | 🔲 SA-1.5 |
| **0044** | `0044_partner_credit_pools.sql` | Partner credit pool tables | 🔲 SA-1.6 |
| **0045** | `0045_ai_usage_events.sql` | `ai_usage_events` audit table | 🔲 SA-1.9 |
| **0046** | (next after SA-2.0 consent extension) | Consent purpose + withdrawn_at | 🔲 SA-2.0 |
| 0047+ | (vertical migration range — M8b+) | Per-vertical profile tables | 🔲 M8b+ |

> **Rule:** Vertical migrations (M8b+) begin at 0047. Do NOT use 0038–0046 for vertical tables — they are reserved for pre-vertical infrastructure. When implementing a new vertical, use the next unused number ≥ 0047.

---

## Completion Checklist — Gate for M8a Vertical Framework

Before M8a (vertical framework scaffolding) may begin, verify:

### Phase 0
- [x] DOC-1 — vision-and-mission.md pillar order corrected
- [x] DOC-2 — ARCHITECTURE.md 3-in-1 table added
- [x] DOC-3 — verticals-master-plan.md pillar column added
- [x] DOC-5 — MASTER_CONTINUATION_PROMPT.md task block template updated
- [x] DOC-6 — 3-in-1 position statement in all 6 AI governance docs
- [x] DOC-8 — `docs/governance/3in1-platform-architecture.md` created
- [x] PV-0.2 — Migration 0037 created (apply to D1 before M8a)
- [ ] PV-0.3 — `[Pillar N]` prefixes in all package.json descriptions
- [ ] PV-0.4 — GitHub labels created (5 `3in1:*` labels)
- [ ] PV-0.5 — Pillar labels applied to all 7 existing execution prompt docs

### Phase 1 (gate for M8b Pillar 2/3 dependent verticals)
- [ ] PV-1.1 — `apps/brand-runtime/` scaffolded and serving branded pages
- [ ] PV-1.2 — `apps/public-discovery/` scaffolded and serving geography-first listings
- [ ] PV-1.3 — `packages/white-label-theming/` wired to `apps/brand-runtime/`

### Phase 2 (gate for any vertical with AI advisory features)
- [ ] SA-1.1 — AIProvider union + AICapabilityType expanded
- [ ] SA-1.2 — 5-level routing engine implemented
- [ ] SA-1.3 — Provider adapters (openai-compat, anthropic, google) implemented
- [ ] SA-1.4 — SuperAgent key service + migration 0042 applied
- [ ] SA-1.5 — WakaCU wallet service + migration 0043 applied
- [ ] SA-1.6 — Partner credit pool + migration 0044 applied
- [ ] SA-1.7 — Credit burn engine implemented
- [ ] SA-1.8 — Auth hooks for AI-enabled users implemented
- [ ] SA-1.9 — Usage metering + audit log + migration 0045 applied

### Phase 3 (gate for any vertical with NDPR-gated AI features)
- [ ] SA-2.0 — NDPR AI consent gate (grant/withdraw/check)
- [ ] SA-2.1 — HITL queue (reserved)
- [ ] SA-2.2 — Workspace AI settings per-vertical (reserved)

---

## Supersession Notice

This document **replaces** `docs/execution-prompts/webwaka_preverticals_execution_prompts.md` in full.

The old document remains in the repository for historical reference but must NOT be used as an execution source. Any agent encountering the old document should:
1. Note the existence of this unified plan
2. Redirect all pre-verticals execution to this document
3. Ignore the old document entirely

The following changes vs. the old plan:
- Adds Phase 0 (3-in-1 alignment) — 5 tasks missing from old plan
- Adds Phase 1 (Pillar 2 + Pillar 3 scaffolding) — 3 tasks missing from old plan
- Adds `primary_pillars` label to every SA task block
- Adds migration number registry
- Adds completion checklist as M8a gate
- Clarifies SuperAgent as cross-cutting layer (not a pillar) throughout
- Adds PV-1.1/PV-1.2 as explicit gates before M8b Pillar 2/3 dependent verticals

---

*Last updated: 2026-04-09*  
*Supersedes: `docs/execution-prompts/webwaka_preverticals_execution_prompts.md`*  
*Companion documents: `docs/governance/3in1-platform-architecture.md`, `docs/governance/webwaka_3in1_remediation_plan.md`, `docs/governance/verticals-master-plan.md`*  
*All pre-verticals work tracked against: `docs/execution-prompts/PROGRESS.md`*
