# WebWaka OS

## Overview

WebWaka OS is a multi-tenant, multi-vertical, white-label SaaS platform operating system for Africa, starting with Nigeria. It follows a governance-driven monorepo architecture with "Offline First," "Mobile First," and "Nigeria First" as core principles.

**Current Milestone: 4 — Discovery Layer MVP (ACTIVE)**

## Milestone Status

| Milestone | Status |
|---|---|
| 0 — Program Setup | ✅ DONE |
| 1 — Governance Baseline | ✅ DONE |
| 2 — Monorepo Scaffolding | ✅ DONE — Founder approved 2026-04-07 |
| 3 — Vertical Package Scaffolding + First API Wiring | ✅ DONE — Founder approved 2026-04-07 20:31 WAT — 151 tests, 11 packages clean |
| 4 — Discovery Layer MVP | 🟢 ACTIVE — Brief published 2026-04-07 20:31 WAT |

## Tech Stack (Target Production)

- **Runtime:** Cloudflare Workers (Edge-first)
- **Language:** TypeScript (strict mode everywhere)
- **API Framework:** Hono
- **Frontend:** React + PWA
- **Database:** Cloudflare D1 (SQLite at the edge) — shared staging + shared production (TDR-0007)
- **Cache/Config:** Cloudflare KV
- **Storage:** Cloudflare R2
- **Offline Sync:** Dexie.js + Service Workers
- **AI Integration:** Vendor-neutral abstraction (BYOK capable)
- **Package Manager:** pnpm workspaces

## Repository Structure

```
webwaka-os/
  apps/
    api/                    — Cloudflare Workers API (Hono) ✅ M3 complete
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
  infra/
    db/
      migrations/           — D1 SQL migration files (0001–0009 after M4) ✅
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
  ↑
apps/api              (depends on: all packages above)
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

Tests use a local `D1Stmt` interface to type in-memory mocks without `vi.fn()` on generic methods:
```typescript
interface D1Stmt {
  bind(...args: unknown[]): D1Stmt;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}
```
`first` and `all` must be plain generic async functions (not `vi.fn()`), since `vi.fn()` strips generic type parameters.

## Test Summary (Milestone 3 final — baseline for M4)

| Package | Tests | Status |
|---|---|---|
| @webwaka/geography | 21 | ✅ All passing |
| @webwaka/politics | 16 | ✅ All passing |
| @webwaka/auth | 34 | ✅ All passing |
| @webwaka/entitlements | 27 | ✅ All passing |
| @webwaka/entities | 30 | ✅ All passing |
| @webwaka/relationships | 5 | ✅ All passing |
| @webwaka/offline-sync | 4 | ✅ All passing |
| apps/api | 14 | ✅ All passing |
| **Total** | **151** | ✅ All passing |

**M4 target:** 171+ tests (151 baseline + ≥20 new discovery tests)

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

## API Routes (apps/api — Hono Worker, M3 baseline + M4 additions)

### Milestone 3 Routes

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

### Milestone 4 Routes (to be added)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/discovery/search` | none | Full-text + geography search |
| GET | `/discovery/profiles/:subjectType/:subjectId` | none | Public profile hydration |
| POST | `/discovery/claim-intent` | none | Capture claim interest |
| GET | `/discovery/nearby/:placeId` | none | Entities in geography subtree |
| GET | `/discovery/trending` | none | Most-viewed profiles this week |

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
