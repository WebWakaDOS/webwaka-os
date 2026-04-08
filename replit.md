# WebWaka OS

## Overview

WebWaka OS is a multi-tenant, multi-vertical, white-label SaaS platform operating system for Africa, starting with Nigeria. It follows a governance-driven monorepo architecture with "Offline First," "Mobile First," and "Nigeria First" as core principles.

**Current Milestone: 6 — Complete Pre-Vertical Platform (IN PROGRESS on feat/milestone-6)**

## Milestone Status

| Milestone | Status |
|---|---|
| 0 — Program Setup | ✅ DONE |
| 1 — Governance Baseline | ✅ DONE |
| 2 — Monorepo Scaffolding | ✅ DONE — Founder approved 2026-04-07 |
| 3 — Vertical Package Scaffolding + First API Wiring | ✅ DONE — Founder approved 2026-04-07 20:31 WAT |
| 4 — Discovery Layer MVP | ✅ DONE — Founder approved 2026-04-07 — 171 tests, 12 packages clean |
| 5 — Claim-First Onboarding | ✅ DONE — PR #16 merged — 202 tests, 13 packages clean |
| 6 — Complete Pre-Vertical Platform | ✅ DONE — PR #17 merged to main 2026-04-07 — 300 tests |
| 7a — Auth + Identity + KYC + OTP | ✅ DONE — PR #21 merged (d629339) — 66 new tests, 0 TS errors |
| 7b — Offline Sync + USSD Gateway + POS Float Ledger | ✅ DONE — PR #24 open — 178 new tests, 0 TS errors |
| 7c–7e — Community + Social + AI + Payments | 🔲 PLANNED |

## Tech Stack (Target Production)

- **Runtime:** Cloudflare Workers (Edge-first)
- **Language:** TypeScript (strict mode everywhere)
- **API Framework:** Hono
- **Frontend:** React + PWA
- **Database:** Cloudflare D1 (SQLite at the edge) — shared staging + shared production (TDR-0007)
- **Cache/Config:** Cloudflare KV
- **Storage:** Cloudflare R2
- **Payments:** Paystack (NGN-first, kobo integers)
- **Offline Sync:** Dexie.js + Service Workers
- **AI Integration:** Vendor-neutral abstraction (BYOK capable)
- **Package Manager:** pnpm workspaces

## Repository Structure

```
webwaka-os/
  apps/
    api/                    — Cloudflare Workers API (Hono) ✅ M5 complete
    tenant-public/          — White-label public discovery Worker ✅ M6
    admin-dashboard/        — Admin dashboard Hono Worker ✅ M6
    projections/            — Event processor Worker ✅ M6
    platform-admin/         — Super admin dashboard (running on port 5000)
    partner-admin/          — Partner/tenant management portal (future)
    public-discovery/       — Public search and discovery (future)
    brand-runtime/          — Tenant-branded storefronts (future)
  packages/
    types/                  — @webwaka/types: Canonical TypeScript types ✅
    core/
      geography/            — @webwaka/geography: Geography hierarchy + D1 loader ✅
      politics/             — @webwaka/politics: Political office + territory model ✅
    auth/                   — @webwaka/auth: JWT (issue + verify) + entitlement guards ✅
    entitlements/           — @webwaka/entitlements: Plan evaluation + layer guards ✅
    entities/               — @webwaka/entities: Individual/Org/Profile repositories ✅
    relationships/          — @webwaka/relationships: Typed link graph (D1) ✅
    offline-sync/           — @webwaka/offline-sync: Sync envelope types (scaffold) ✅
    ai-abstraction/         — @webwaka/ai-abstraction: AI provider interface (scaffold) ✅
    search-indexing/        — @webwaka/search-indexing: Search adapter types (M4 scaffold)
    claims/                 — @webwaka/claims: Claim state machine + verification helpers (M5) ✅
    payments/               — @webwaka/payments: Paystack integration + subscription sync (M6) ✅
    events/                 — @webwaka/events: Domain event bus + projections (M6) ✅
    frontend/               — @webwaka/frontend: Tenant manifest + profile renderer + admin layout (M6) ✅
  infra/
    db/
      migrations/           — D1 SQL migration files (0001–0012 after M6) ✅
      seed/                 — Nigeria geography seed + LGA data ✅
      seed/scripts/         — INEC CSV → ward SQL importer ✅
    cloudflare/             — Cloudflare infrastructure config
    github-actions/         — CI/CD workflow references
  docs/
    governance/             — 16 governance documents (Milestone 1 baseline)
    architecture/decisions/ — 12 TDRs (Milestone 1 baseline)
    milestones/             — Replit briefs per milestone
  tests/                    — e2e, integration, smoke (future)
```

## Package Dependencies

```
@webwaka/types (no internal deps)
  ↑
@webwaka/geography    (depends on: types)
@webwaka/politics     (depends on: types, geography)
@webwaka/auth         (depends on: types)
@webwaka/entitlements (depends on: types, auth)
@webwaka/entities     (depends on: types, geography)
@webwaka/relationships(depends on: types)
@webwaka/offline-sync (depends on: types)
@webwaka/ai-abstraction (no internal deps)
@webwaka/search-indexing (depends on: types)  ← M4 scaffold
@webwaka/claims       (depends on: types)     ← M5
@webwaka/payments     (no internal deps)      ← M6 (Paystack)
@webwaka/events       (no internal deps)      ← M6 (domain bus)
@webwaka/frontend     (no internal deps)      ← M6 (tenant manifest, renderer)
  ↑
apps/api              (depends on: all packages above)
apps/tenant-public    (depends on: frontend)
apps/admin-dashboard  (depends on: frontend, payments)
apps/projections      (depends on: events)
```

## Running Locally (Development)

- **Workflow:** `Start application`
- **Command:** `node apps/platform-admin/server.js`
- **Port:** 5000
- **Host:** 0.0.0.0

## Key Dev Commands

```bash
pnpm install                           # Install all workspace packages
pnpm -r run typecheck                  # Typecheck all packages (must be zero errors)
pnpm -r run test                       # Run full workspace test suite
pnpm seed:wards <path-to-inec-csv>     # Generate infra/db/seed/0003_wards.sql from INEC CSV
```

## tsconfig Pattern (Two tsconfigs per dependent package)

Each package that depends on other workspace packages uses two tsconfig files:
- `tsconfig.json` — for IDE/typecheck: has `paths` pointing to source, wide `rootDir` encompassing all workspace sources. Use: `tsc --noEmit`
- `tsconfig.build.json` — for building dist: `rootDir: "src"`, `outDir: "dist"`, no cross-package paths. Use: `tsc -p tsconfig.build.json`

The `types` package has only `tsconfig.json` (no cross-package deps, standard `rootDir: "src"`).

## D1 Mock Pattern (In Tests)

Tests use a local `D1Like` interface defined in each file (not a shared import):
```typescript
interface D1Like {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    run(): Promise<{ success: boolean }>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}
```
`first` and `all` must be plain generic async functions (not `vi.fn()`), since `vi.fn()` strips generic type parameters.

**D1Like local interface pattern (CRITICAL):** Every file touching D1 must define its own local `D1Like` interface. Never import a shared one.

## Test Summary (Milestone 6 — Complete Pre-Vertical Platform)

| Package | Tests | Status |
|---|---|---|
| @webwaka/geography | 21 | ✅ All passing |
| @webwaka/politics | 16 | ✅ All passing |
| @webwaka/auth | 34 | ✅ All passing |
| @webwaka/entitlements | 27 | ✅ All passing |
| @webwaka/entities | 30 | ✅ All passing |
| @webwaka/relationships | 5 | ✅ All passing |
| @webwaka/offline-sync | 4 | ✅ All passing |
| @webwaka/search-indexing | 0 | ✅ passWithNoTests (scaffold only) |
| @webwaka/claims | 15 | ✅ All passing |
| @webwaka/payments | 16 | ✅ All passing (M6) |
| @webwaka/events | 19 | ✅ All passing (M6) |
| @webwaka/frontend | 45 | ✅ All passing (M6) |
| apps/api | 62 | ✅ All passing (50 M5 base + 12 new M6) |
| **Total** | **294** | ✅ All passing |

## D1 Migration Files

| File | Description |
|---|---|
| `0001_init_places.sql` | Places table with geography hierarchy |
| `0002_init_entities.sql` | Individuals + Organizations root entities |
| `0003_init_workspaces_memberships.sql` | Workspaces + Memberships |
| `0004_init_subscriptions.sql` | Subscriptions |
| `0005_init_profiles.sql` | Profiles (discovery records) |
| `0006_init_political.sql` | Jurisdictions, terms, political assignments, party affiliations |
| `0007_init_relationships.sql` | Entity relationship graph (typed links) |
| `0007a_political_assignments_constraint.sql` | CandidateRecord.id + UNIQUE constraint |
| `0008_init_search_index.sql` | Search entries + FTS5 virtual table ← M4 |
| `0009_init_discovery_events.sql` | Discovery events log ← M4 |
| `0010_claim_workflow.sql` | claim_requests table + indexes ← M5 |
| `0011_payments.sql` | billing_history table + indexes ← M6 |
| `0012_event_log.sql` | event_log append-only table + indexes ← M6 |

## Seed Data

| File | Description |
|---|---|
| `infra/db/seed/nigeria_country.sql` | 1 country record |
| `infra/db/seed/nigeria_zones.sql` | 6 geopolitical zones |
| `infra/db/seed/nigeria_states.sql` | 37 states (FCT + 36 states) |
| `infra/db/seed/0002_lgas.sql` | 775 LGAs (all Nigeria LGAs + Imeko-Afon Ogun, previously missing) |
| `infra/db/seed/0003_wards.sql` | 8,810 wards — all Nigeria wards from INEC data |

Ward seed is pre-committed. Source: `nielvid/states-lga-wards-polling-units` (GitHub, INEC data).
8,810 / 8,810 wards matched — zero unmatched. 767 INSERT batches (≤50 rows each).

## API Routes (apps/api — Hono Worker)

### Core Routes (M3)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Liveness probe |
| POST | `/auth/login` | none | Issue JWT |
| POST | `/auth/refresh` | JWT | Refresh JWT |
| GET | `/auth/me` | JWT | Current auth context |
| POST | `/auth/verify` | none | Verify JWT, return payload |
| GET | `/geography/places/:id` | none | Place node |
| GET | `/geography/places/:id/children` | none | Children of place |
| GET | `/geography/places/:id/ancestry` | none | Ancestry breadcrumb |
| GET | `/entities/individuals` | JWT | List individuals (tenant-scoped) |
| POST | `/entities/individuals` | JWT | Create individual |
| GET | `/entities/individuals/:id` | JWT | Get individual |
| GET | `/entities/organizations` | JWT | List organizations (tenant-scoped) |
| POST | `/entities/organizations` | JWT | Create organization |
| GET | `/entities/organizations/:id` | JWT | Get organization |

### Discovery Routes (M4 — public, no auth)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/discovery/search` | none | Full-text + geography search |
| GET | `/discovery/profiles/:subjectType/:subjectId` | none | Public profile hydration |
| POST | `/discovery/claim-intent` | none | Capture claim interest |
| GET | `/discovery/nearby/:placeId` | none | Entities in geography subtree |
| GET | `/discovery/trending` | none | Most-viewed profiles this week |

### Claim + Workspace Routes (M5)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/claim/intent` | JWT | Convert discovery intent → formal claim_request |
| POST | `/claim/advance` | JWT (admin) | Advance claim state: approve or reject |
| POST | `/claim/verify` | JWT | Submit verification evidence |
| GET | `/claim/status/:profileId` | none | Public claim status + checklist |
| POST | `/workspaces/:id/activate` | JWT | Activate workspace plan |
| PATCH | `/workspaces/:id` | JWT (admin) | Update plan/name |
| POST | `/workspaces/:id/invite` | JWT | Invite member to workspace |
| GET | `/workspaces/:id/analytics` | JWT | Usage metrics |

### M6 Routes — Payments + Frontend

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/workspaces/:id/upgrade` | JWT | Initialise Paystack checkout |
| POST | `/payments/verify` | JWT | Verify + sync Paystack payment |
| GET | `/workspaces/:id/billing` | JWT | Billing history |
| GET | `/public/:tenantSlug` | none | Tenant manifest + discovery page |
| GET | `/admin/:workspaceId/dashboard` | none | Admin layout model |
| POST | `/themes/:tenantId` | JWT | Update tenant branding |

## Cloudflare Worker Bindings (Env interface)

| Binding | Type | Purpose |
|---|---|---|
| `DB` | D1Database | Main SQLite database |
| `GEOGRAPHY_CACHE` | KVNamespace | Geography index cache |
| `JWT_SECRET` | string | JWT HMAC secret (CF Worker Secret) |
| `ENVIRONMENT` | string | development / staging / production |
| `PAYSTACK_SECRET_KEY` | string | Paystack API secret (CF Worker Secret, M6) |

## Deployment

- **Target:** autoscale
- **Run command:** `node apps/platform-admin/server.js`
- **Production:** Requires Cloudflare credentials (see `.env.example` and `docs/governance/security-baseline.md`)

## Key Governance Documents

- `docs/governance/platform-invariants.md` — Non-negotiable rules (read before implementing)
- `docs/governance/universal-entity-model.md` — Root entity definitions
- `docs/governance/geography-taxonomy.md` — Geography hierarchy
- `docs/governance/political-taxonomy.md` — Political office model
- `docs/governance/entitlement-model.md` — Subscription-gated access rules
- `docs/governance/claim-first-onboarding.md` — Claim lifecycle (seeded → managed)
- `docs/architecture/decisions/` — 12 Technical Decision Records

## Important Invariants for All Agents

- T2: TypeScript strict mode everywhere. `any` requires a comment explaining why.
- T3: Every query on tenant-scoped data includes `tenant_id`. No exceptions.
- T4: All monetary values stored as **integer kobo** (NGN × 100). No floats.
- T5: Feature access gated by entitlement check via `@webwaka/entitlements`.
- T6: Discovery driven by `@webwaka/geography` hierarchy — no raw string city/state matching.
- Discovery routes are **public** (no auth). Never expose `tenant_id` in public responses.

## Agent Scratchpad (Critical Patterns)

- **D1Like local interface pattern:** Every file touching D1 must define its own local `D1Like` interface. Never import a shared one.
- **Auth middleware pattern:** Apply `authMiddleware` at app level in `index.ts` via `app.use('/route/path', authMiddleware)`, NOT inline in route handlers — inline breaks test mocking.
- **vitest.config.ts alias pattern:** Every new workspace package used in `apps/api` must be added to `apps/api/vitest.config.ts` resolve.alias AND `apps/api/tsconfig.json` paths.
- **exactOptionalPropertyTypes:** Use conditional spread `...(val !== undefined ? { key: val } : {})` for optional object fields. Returning `{ key: undefined }` to an `{ key?: T }` type fails.
- **State key compact format:** `akwaibom` (not `akwa_ibom`), `crossriver` (not `cross_river`).
- **Workspace ownerId type:** `IndividualId | OrganizationId` (not UserId) — cast to string for comparison.
- **Paystack amounts:** Always in kobo (NGN × 100). Paystack sends amounts as integers.
