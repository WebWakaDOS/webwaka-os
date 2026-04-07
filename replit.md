# WebWaka OS

## Overview

WebWaka OS is a multi-tenant, multi-vertical, white-label SaaS platform operating system for Africa, starting with Nigeria. It follows a governance-driven monorepo architecture with "Offline First," "Mobile First," and "Nigeria First" as core principles.

**Current Milestone: 2 — Monorepo Scaffolding and Shared Core Foundations (APPROVED WITH FIXES APPLIED)**

## Milestone Status

| Milestone | Status |
|---|---|
| 0 — Program Setup | ✅ DONE |
| 1 — Governance Baseline | ✅ DONE |
| 2 — Monorepo Scaffolding | 🟡 FIXES APPLIED — awaiting Base44 CI verification + Founder approval |

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
    api/                    — Cloudflare Workers API (Milestone 2 phase 2)
    platform-admin/         — Super admin dashboard (running on port 5000)
    partner-admin/          — Partner/tenant management portal (Milestone 2 phase 2)
    public-discovery/       — Public search and discovery (Milestone 3)
    brand-runtime/          — Tenant-branded storefronts (Milestone 3)
  packages/
    types/                  — @webwaka/types: Canonical TypeScript types ✅
    core/
      geography/            — @webwaka/geography: Geography hierarchy + rollup helpers ✅
      politics/             — @webwaka/politics: Political office + territory model ✅
    auth/                   — @webwaka/auth: JWT validation + entitlement guards ✅
  infra/
    db/
      migrations/           — D1 SQL migration files (0001–0006) ✅
      seed/                 — Nigeria geography seed data (country + zones + states) ✅
    cloudflare/             — Cloudflare infrastructure config
    github-actions/         — CI/CD workflow references
  docs/
    governance/             — 16 governance documents (Milestone 1 baseline)
    architecture/decisions/ — 12 TDRs (Milestone 1 baseline)
  tests/                    — e2e, integration, smoke (Milestone 2+)
```

## Package Dependencies

```
@webwaka/types (no internal deps)
  ↑
@webwaka/geography (depends on: types)
@webwaka/politics  (depends on: types, geography)
@webwaka/auth      (depends on: types)
```

## Running Locally (Development)

- **Workflow:** `Start application`
- **Command:** `node apps/platform-admin/server.js`
- **Port:** 5000
- **Host:** 0.0.0.0

## Key Dev Commands

```bash
pnpm install                                # Install all workspace packages
pnpm --filter @webwaka/types build          # Build types (required before other packages)
pnpm --filter @webwaka/geography typecheck  # Typecheck geography (resolves via paths from source)
pnpm --filter @webwaka/politics typecheck   # Typecheck politics  (resolves via paths from source)
pnpm --filter @webwaka/auth typecheck       # Typecheck auth      (resolves via paths from source)
pnpm -r build                               # Build all packages in dependency order
pnpm -r test                                # Run full workspace test suite
```

## tsconfig Pattern (Two tsconfigs per dependent package)

Each package that depends on other workspace packages uses two tsconfig files:
- `tsconfig.json` — for IDE/typecheck: has `paths` pointing to source, wide `rootDir` encompassing all workspace sources. Use: `tsc --noEmit`
- `tsconfig.build.json` — for building dist: `rootDir: "src"`, `outDir: "dist"`, no cross-package paths. Use: `tsc -p tsconfig.build.json`

The `types` package has only `tsconfig.json` (no cross-package deps, standard `rootDir: "src"`).

## Test Summary (Milestone 2 — All fixes applied)

| Package | Tests | Status |
|---|---|---|
| @webwaka/geography | 21 | ✅ All passing |
| @webwaka/politics | 16 | ✅ All passing |
| @webwaka/auth | 34 (was 24 — +10 jwt.test.ts) | ✅ All passing |
| **Total** | **71** | ✅ All passing |

## D1 Migration Files

| File | Description |
|---|---|
| `0001_init_places.sql` | Places table with geography hierarchy |
| `0002_init_entities.sql` | Individuals + Organizations root entities |
| `0003_init_workspaces_memberships.sql` | Workspaces + Memberships |
| `0004_init_subscriptions.sql` | Subscriptions |
| `0005_init_profiles.sql` | Profiles (discovery records) |
| `0006_init_political.sql` | Jurisdictions, terms, political assignments, party affiliations |

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
- T5: Feature access gated by entitlement check via `@webwaka/auth`.
- T6: Discovery driven by `@webwaka/geography` hierarchy — no raw string city/state matching.
