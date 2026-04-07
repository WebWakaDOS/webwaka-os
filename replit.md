# WebWaka OS

## Overview

WebWaka OS is a multi-tenant, multi-vertical, white-label SaaS platform operating system for Africa, starting with Nigeria. It follows a governance-driven monorepo architecture with "Offline First," "Mobile First," and "Nigeria First" as core principles.

**Current Milestone: 3 — API Worker + Database Layer (IN PROGRESS)**

## Milestone Status

| Milestone | Status |
|---|---|
| 0 — Program Setup | ✅ DONE |
| 1 — Governance Baseline | ✅ DONE |
| 2 — Monorepo Scaffolding | ✅ DONE — Founder approved 2026-04-07 |
| 3 — API Worker + Database Layer | 🟡 READY FOR REVIEW — packages complete, API wired, 154 tests passing, 8,810 ward seed committed |

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
    api/                    — Cloudflare Workers API (Hono, Milestone 3) ✅
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
  infra/
    db/
      migrations/           — D1 SQL migration files (0001–0007) ✅
      seed/                 — Nigeria geography seed + LGA data ✅
      seed/scripts/         — INEC CSV → ward SQL importer ✅
    cloudflare/             — Cloudflare infrastructure config
    github-actions/         — CI/CD workflow references
  docs/
    governance/             — 16 governance documents (Milestone 1 baseline)
    architecture/decisions/ — 12 TDRs (Milestone 1 baseline)
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
@webwaka/entities     (depends on: types)
@webwaka/relationships(depends on: types)
@webwaka/offline-sync (depends on: types)
@webwaka/ai-abstraction (no internal deps)
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
pnpm -r run typecheck                  # Typecheck all 11 packages (must be clean)
pnpm -r run test                       # Run full workspace test suite (154 tests)
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

## Test Summary (Milestone 3 — All packages)

| Package | Tests | Status |
|---|---|---|
| @webwaka/geography | 21 | ✅ All passing |
| @webwaka/politics | 16 | ✅ All passing |
| @webwaka/auth | 34 | ✅ All passing |
| @webwaka/entitlements | 27 | ✅ All passing |
| @webwaka/entities | 30 | ✅ All passing |
| @webwaka/relationships | 5 | ✅ All passing |
| @webwaka/offline-sync | 4 | ✅ All passing |
| apps/api | 9 | ✅ All passing |
| **Total** | **146** | ✅ All passing |

## D1 Migration Files

| File | Description |
|---|---|
| `0001_init_places.sql` | Places table with geography hierarchy |
| `0002_init_entities.sql` | Individuals + Organizations root entities |
| `0003_init_workspaces_memberships.sql` | Workspaces + Memberships |
| `0004_init_subscriptions.sql` | Subscriptions |
| `0005_init_profiles.sql` | Profiles (discovery records) |
| `0006_init_political.sql` | Jurisdictions, terms, political assignments, party affiliations |
| `0007_relationships.sql` | Entity relationship graph (typed links) |
| `0007a_candidates.sql` | CandidateRecord.id column + political constraints |

## Seed Data

| File | Description |
|---|---|
| `infra/db/seed/0001_geography.sql` | 1 country + 6 zones + 37 states |
| `infra/db/seed/0002_lgas.sql` | 775 LGAs (all Nigeria LGAs + Imeko-Afon Ogun, previously missing) |
| `infra/db/seed/0003_wards.sql` | 8,810 wards — all Nigeria wards from INEC data (committed) |

Ward seed is pre-committed. Source: `nielvid/states-lga-wards-polling-units` (GitHub, INEC data).
8,810 / 8,810 wards matched — zero unmatched. 767 INSERT batches (≤50 rows each).
LGA alias resolution covered all spelling variants; Imeko-Afon LGA added to `0002_lgas.sql` (775 total).

To re-generate (not normally needed):
```bash
pnpm seed:wards <path-to-inec-csv>
# or: npx tsx infra/db/seed/scripts/generate_wards_sql.ts <path-to-csv>
```

## API Routes (apps/api — Hono Worker)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Liveness probe |
| POST | `/auth/login` | none | Issue JWT |
| POST | `/auth/refresh` | JWT | Refresh JWT |
| GET | `/geography/:id` | none | Place node |
| GET | `/geography/:id/children` | none | Children of place |
| GET | `/entities/individuals` | JWT | List individuals (tenant-scoped) |
| POST | `/entities/individuals` | JWT + entitlement | Create individual |
| GET | `/entities/individuals/:id` | JWT | Get individual |
| GET | `/entities/organizations` | JWT | List organizations (tenant-scoped) |
| POST | `/entities/organizations` | JWT + entitlement | Create organization |
| GET | `/entities/organizations/:id` | JWT | Get organization |

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
- `docs/architecture/decisions/` — 12 Technical Decision Records

## Important Invariants for All Agents

- T2: TypeScript strict mode everywhere. `any` requires a comment explaining why.
- T3: Every query on tenant-scoped data includes `tenant_id`. No exceptions.
- T4: All monetary values stored as **integer kobo** (NGN × 100). No floats.
- T5: Feature access gated by entitlement check via `@webwaka/entitlements`.
- T6: Discovery driven by `@webwaka/geography` hierarchy — no raw string city/state matching.
