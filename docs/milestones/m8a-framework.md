# M8a — Verticals Infrastructure Framework

**Status:** Planning — Prerequisite for all M8b+ work
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09
**Duration:** 3 days
**Blocks:** M8b, M8c, M8d, M8e — ALL PARALLEL after M8a complete

---

## Goal

Deliver the foundational infrastructure that enables all 160+ WebWaka OS verticals to be activated. **No individual vertical is implemented in M8a.** This is the engine, not the application.

---

## Deliverables

### D1. `infra/db/migrations/0036_verticals_table.sql` ✅
**Status:** CREATED (2026-04-09)

Verticals registry table with full column set:
- `slug`, `display_name`, `category`, `subcategory`, `priority`
- `entity_type`, `fsm_states`, `required_kyc_tier`
- `requires_frsc`, `requires_cac`, `requires_it`, `requires_community`, `requires_social`
- `package_name`, `milestone_target`, `status`

### D2. `infra/db/seeds/0004_verticals-master.csv` ✅
**Status:** CREATED (2026-04-09) — 160 verticals seeded

Seed data for all 160 verticals:
- 17 P1-Original verticals (priority = 1)
- ~80 P2-High-Fit (priority = 2)
- ~63 P3-Medium (priority = 3)

To apply: `wrangler d1 execute webwaka-os-{env} --file=infra/db/migrations/0036_verticals_table.sql && wrangler d1 execute webwaka-os-{env} --command="$(cat infra/db/seeds/0004_verticals-master.csv | ...csv-to-sql...)"`

### D3. `packages/verticals/` — FSM engine + router + entitlements matrix ✅
**Status:** SCAFFOLD CREATED (2026-04-09)

```
packages/verticals/
├── src/
│   ├── types.ts          -- VerticalRecord, VerticalFSMDefinition, etc.
│   ├── fsm.ts            -- BASE_VERTICAL_FSM + assertValidTransition + composeVerticalFSM
│   ├── router.ts         -- getVerticalBySlug + checkActivationRequirements
│   ├── entitlements.ts   -- VERTICAL_ENTITLEMENTS static matrix (17 P1 verticals)
│   ├── fsm.test.ts       -- FSM engine tests
│   ├── router.test.ts    -- Router + entitlements tests
│   └── index.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .eslintrc.json
```

**Tests:** 30+ tests covering FSM transitions, entitlements matrix, activation requirements.

### D4. API Route: `GET /verticals` + `GET /verticals/:slug` (NOT YET IMPLEMENTED)

**Target:** `apps/api/src/routes/verticals.ts`

```typescript
// GET /verticals?category=transport&priority=1
// GET /verticals/:slug
```

**Tests required:** 5+ route tests.

### D5. `pnpm-workspace.yaml` — add `packages/verticals` (NOT YET IMPLEMENTED)

Wire `@webwaka/verticals` into the monorepo workspace.

---

## M8a Implementation Checklist

```
[ ] D1: Migration 0036 wired in Cloudflare wrangler.toml (staging + production)
[ ] D2: CSV seed applied to staging D1 — 160 rows confirmed
[ ] D3: packages/verticals typecheck passes (pnpm --filter @webwaka/verticals typecheck)
[ ] D3: packages/verticals tests pass (≥30 tests)
[ ] D4: apps/api/src/routes/verticals.ts — GET /verticals + GET /verticals/:slug
[ ] D4: 5+ route tests in apps/api/src/routes/verticals.test.ts
[ ] D5: packages/verticals added to pnpm-workspace.yaml
[ ] D5: pnpm install successful
[ ] ALL: pnpm -r typecheck passes (0 errors)
[ ] ALL: pnpm -r test passes (≥749 tests — 719 baseline + 30 new)
```

---

## Success Criteria

```
✅ packages/verticals published in monorepo
✅ 160 verticals seeded in D1
✅ GET /verticals API endpoint live
✅ FSM engine: composeVerticalFSM() usable by any vertical package
✅ VERTICAL_ENTITLEMENTS: 17 P1 verticals in static matrix
✅ All existing 719 tests still green
✅ ≥30 new tests in packages/verticals
✅ Zero TypeScript errors
```

---

## Unlocks (Post-M8a)

After M8a is complete, the following milestones are **fully parallel** and may be implemented in any order:

- M8b — Politics + POS Business Management
- M8c — Transport Verticals
- M8d — Civic Expansion (Church / NGO / Cooperative)
- M8e — P1 Commerce + Creator

Each implementation milestone follows the per-vertical research template: `docs/templates/vertical-template.md`.
