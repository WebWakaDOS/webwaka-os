# Vertical Research & Implementation Template

**Status:** Template — M8 Planning
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09
**Usage:** Complete this template before implementing any vertical. One file per vertical.

---

## How to Use This Template

1. Copy this file to `docs/verticals/{slug}-brief.md`
2. Complete ALL sections before opening an implementation PR
3. Link the brief in the PR description
4. Implementation agent uses this as the authoritative spec

---

# Vertical: [Vertical Name]

**Slug:** `[slug]`
**Category:** `[politics|transport|civic|commerce|health|education|professional|creator|place|financial|agricultural|media|institutional]`
**Priority:** `[P1-Original | P2-High-Fit | P3-Medium]`
**Entity Type:** `[individual | organization | place | offering]`
**Target Milestone:** `[M8b | M8c | M8d | M8e | M9 | M10 | M11 | M12]`

---

## Section 1 — Market Research

### 1.1 Nigeria Market Size

```
Estimated operator count: [e.g. 850,000 motor parks and transport operators]
Key states: [e.g. Lagos, Kano, Rivers, Abuja FCT, Ogun]
NBS/SMEDAN reference: [link or citation if available]
Revenue potential: [₦X per operator per month]
```

### 1.2 Competitor Analysis

| Competitor | Strengths | Weaknesses | WebWaka Advantage |
|---|---|---|---|
| [Name 1] | | | |
| [Name 2] | | | |
| [Name 3] | | | |

### 1.3 Operator Pain Points (Top 5)

1. [Pain point 1]
2. [Pain point 2]
3. [Pain point 3]
4. [Pain point 4]
5. [Pain point 5]

---

## Section 2 — Feature Catalogue (≥50 features)

Derived from competitor analysis + operator interviews + SMEDAN/NBS research.

### Discovery & Profile (always included)
- [ ] Public profile page with geography-pinned location
- [ ] Search indexing by category + geography
- [ ] Photo gallery / portfolio
- [ ] Contact channels (WhatsApp, phone, email, Telegram)
- [ ] Verified badge (NIN/BVN blue-tick)
- [ ] Rating and review system
- [ ] Operating hours display
- [ ] Geography map embed

### Workspace & Operations (vertical-specific)
- [ ] [Feature 1]
- [ ] [Feature 2]
- [ ] [Feature 3]
- [ ] [Feature 4]
- [ ] [Feature 5]
- [ ] [Feature 6]
- [ ] [Feature 7]
- [ ] [Feature 8]
- [ ] [Feature 9]
- [ ] [Feature 10]

### Offerings & Commerce
- [ ] [Offering type 1 — e.g. route booking, appointment, product catalog]
- [ ] [Offering type 2]
- [ ] [Offering type 3]
- [ ] Paystack payment integration
- [ ] Invoice generation
- [ ] Receipt / proof of transaction

### Compliance & Regulatory
- [ ] [Regulatory requirement 1 — e.g. FRSC license display]
- [ ] [Regulatory requirement 2]
- [ ] KYC tier enforcement (Tier [X] required)
- [ ] NDPR consent before data lookups

### Community & Social (if applicable)
- [ ] [Community feature 1 — e.g. congregation management]
- [ ] [Community feature 2]
- [ ] Social profile + follow
- [ ] Broadcast messages to members

### Analytics & Reporting
- [ ] Daily/weekly/monthly activity summary
- [ ] [Vertical-specific metric 1 — e.g. passenger count, revenue per route]
- [ ] [Vertical-specific metric 2]
- [ ] Export to CSV / PDF

### Notifications
- [ ] SMS alerts (Termii)
- [ ] WhatsApp notifications (360dialog)
- [ ] Telegram notifications
- [ ] Push notification (PWA)
- [ ] USSD fallback (*384#)

---

## Section 3 — FSM States

```
[slug]_seeded
  ↓ (claim verified — KYC Tier [X])
[slug]_claimed
  ↓ ([regulatory doc] verified via packages/identity)
[slug]_[doc_verified]
  ↓ ([operational prerequisite met])
[slug]_[operational_state]
  ↓ (fully operational)
[slug]_active
  ↓ (compliance failure / non-payment)
[slug]_suspended
  ↓ (permanent removal)
[slug]_deprecated
```

**Transition Guards:**
| From | To | Guard |
|---|---|---|
| `seeded` | `claimed` | `requireKYCTier(1)` + phone verified |
| `claimed` | `[doc_verified]` | `packages/identity.[method]()` + NDPR consent |
| `[doc_verified]` | `active` | `requireKYCTier([X])` |
| `active` | `suspended` | admin action or payment failure |

---

## Section 4 — Existing Infrastructure Used

Complete this section to confirm what does **not** need to be built.

| Infrastructure | Package | How Used |
|---|---|---|
| [e.g. Geography hierarchy] | `packages/geography` | [e.g. Motor park as Facility Place] |
| [e.g. Community spaces] | `packages/community` | [e.g. Congregation channels + courses] |
| [e.g. FRSC verification] | `packages/identity` | [e.g. Operator license verification] |
| [e.g. Social profiles] | `packages/social` | [e.g. Public profile + followers] |
| [e.g. Paystack] | `packages/payments` | [e.g. Dues collection + bookings] |
| [e.g. Event bus] | `packages/events` | [e.g. Route booked → analytics projection] |

---

## Section 5 — New Schema (D1 Additions)

List ONLY new tables/columns needed. Do not duplicate shared tables.

### Migration: `infra/db/migrations/[XXXX]_[slug]_schema.sql`

```sql
-- Example:
CREATE TABLE [slug]_[entities] (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  tenant_id   TEXT NOT NULL,
  -- vertical-specific columns
  created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_[slug]_tenant ON [slug]_[entities](tenant_id);
```

**T3 Rule:** Every new table MUST have `tenant_id NOT NULL` and every query MUST include `WHERE tenant_id = ?`.

---

## Section 6 — New Package

**Package:** `packages/verticals-[slug]/`

```
packages/verticals-[slug]/
├── src/
│   ├── types.ts          -- vertical-specific types
│   ├── [entity].ts       -- D1 repository for main entity
│   ├── [feature].ts      -- key feature module
│   ├── [feature].test.ts
│   ├── [entity].test.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**Exports:**
```typescript
// index.ts
export * from './types';
export * from './[entity]';
export * from './[feature]';
```

---

## Section 7 — API Routes

All routes added to `apps/api/src/routes/[slug].ts` and wired in `apps/api/src/index.ts`.

```
POST /[slug]                      -- create/claim vertical entity
GET  /[slug]/:id                  -- get entity with offerings
PATCH /[slug]/:id                 -- update entity (tenant-scoped)
GET  /[slug]/:id/offerings        -- list active offerings
POST /[slug]/:id/offerings        -- create offering
POST /[slug]/:id/verify/[doc]     -- trigger regulatory verification
GET  /[slug]/:id/analytics        -- usage metrics
```

**Middleware:** `authMiddleware` + `requireKYCTier([X])` on all write routes.

---

## Section 8 — Test Requirements (≥30 tests)

```
packages/verticals-[slug]/src/[entity].test.ts     -- ≥12 entity CRUD tests
packages/verticals-[slug]/src/[feature].test.ts    -- ≥10 feature tests
apps/api/src/routes/[slug].test.ts                 -- ≥8 route tests

Required test scenarios:
[ ] Create entity (valid)
[ ] Get entity by ID (tenant-scoped)
[ ] FSM transition: seeded → claimed
[ ] FSM transition: claimed → [doc_verified]
[ ] FSM transition: [doc_verified] → active
[ ] FSM guard rejection (wrong KYC tier)
[ ] T3 isolation (tenant_id mismatch → null)
[ ] Offering creation
[ ] Regulatory verification mock (success + failure)
[ ] Analytics endpoint
[ ] Auth guard (unauthenticated → 401)
[ ] KYC guard ([below min tier] → 403)
```

---

## Section 9 — Acceptance Criteria

```
[ ] All FSM states implemented and guarded
[ ] All regulatory verifications wired (FRSC/CAC/IT)
[ ] T3 tenant isolation on all queries (pnpm -r typecheck passes)
[ ] ≥30 tests passing
[ ] Zero new TypeScript errors
[ ] Discovery search index updated (publishEvent → search projection)
[ ] replit.md updated with new vertical
[ ] docs/governance/milestone-tracker.md updated
[ ] Offering creation tested end-to-end
[ ] Payments integration tested (if applicable)
```

---

## Section 10 — Deferred Items

List explicitly what is out of scope for this implementation:

1. [Deferred item 1 — e.g. Real-time seat availability (M9)]
2. [Deferred item 2 — e.g. Multi-lingual route names (M10)]
3. [Deferred item 3]

---

*Template version: M8 Planning — 2026-04-09*
*See `docs/governance/verticals-master-plan.md` for priority framework*
*See `docs/governance/verticals-dependency-dag.md` for infrastructure map*
