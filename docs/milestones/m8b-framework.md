# M8b — Original Focus: Politics + POS Business Management

**Status:** Planning — Blocked by M8a
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09
**Duration:** 5 days
**Prerequisite:** M8a complete (packages/verticals + migration 0036 + 160 seeds)

---

## Goal

Implement all P1-Original political verticals and the POS Business Management System (distinct from the existing agent float infrastructure in `packages/pos`).

---

## Verticals in Scope (5)

| Vertical | Slug | Entity Type | P1? | Key Dependency |
|---|---|---|---|---|
| Individual Politician | `politician` | individual | ✅ P1 | politics tables (M2), community, social |
| Political Party | `political-party` | organization | ✅ P1 | politics tables, CAC |
| Campaign Office | `campaign-office` | organization | P3 | social, community |
| LGA / Ward Office | `lga-office` | place | P3 | geography, public notices |
| POS Business Mgmt System | `pos-business` | organization | ✅ P1 | CAC, new inventory schema |

---

## Sample Vertical: Individual Politician (Full Implementation)

Serves as the implementation template for all other M8b verticals.

### Research Brief → `docs/verticals/politician-brief.md`

**Market:** ~15,000 elected officials at all levels across Nigeria
**Key offices:** Councilor (8,809 ward-level), LGA Chairman (774), State Assembly (993), HoR (360), Senate (109), Governors (37), President

**Top 15 Features:**
1. Politician profile with office + constituency + party display
2. Political assignment history (term records)
3. Constituent service request management
4. Constituency project tracker
5. Campaign donation portal (Paystack)
6. Voter mobilization tools (USSD + WhatsApp broadcast)
7. Policy position statements
8. Event calendar (town halls, rallies)
9. Staff / team management workspace
10. Media library (press releases, photos)
11. KPI dashboard (promises made vs delivered)
12. Community space for constituents (M7c)
13. Social profile + follower network (M7d)
14. Biography + career timeline
15. Official contact channels (verified)

### FSM

```
seeded → claimed → candidate → elected → in_office → post_office
                         ↓
                      (active — running for office)
```

Transitions:
| From | To | Guard |
|---|---|---|
| `seeded` | `claimed` | `requireKYCTier(2)` + NIN verified |
| `claimed` | `candidate` | `requireKYCTier(2)` + INEC filing |
| `candidate` | `elected` | admin (election results) |
| `elected` | `in_office` | admin (sworn-in) |
| `in_office` | `post_office` | admin (term end) |
| `in_office` | `active` | synonym (public-facing active state) |

### New Schema (Migration 0037)

```sql
-- packages/verticals-politician/
-- Uses existing: political_assignments, jurisdictions, term_records (M2)
-- Adds:
CREATE TABLE politician_profiles (
  id              TEXT PRIMARY KEY,
  individual_id   TEXT REFERENCES individuals(id),
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  office_type     TEXT NOT NULL,        -- councilor|lga_chairman|state_assembly|hor|senator|governor|president
  jurisdiction_id TEXT NOT NULL,        -- FK → jurisdictions
  party_id        TEXT,                 -- FK → organizations (party)
  nin_verified    INTEGER DEFAULT 0,
  inec_filing_ref TEXT,
  term_start      INTEGER,
  term_end        INTEGER,
  status          TEXT DEFAULT 'seeded',
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_politician_tenant     ON politician_profiles(tenant_id);
CREATE INDEX idx_politician_office     ON politician_profiles(office_type);
CREATE INDEX idx_politician_jurisdiction ON politician_profiles(jurisdiction_id);
```

### Package

```
packages/verticals-politician/
├── src/
│   ├── types.ts
│   ├── politician.ts        -- D1 CRUD (T3 isolation)
│   ├── politician.test.ts   -- ≥15 tests
│   ├── campaign.ts          -- Donation + volunteer management
│   ├── campaign.test.ts     -- ≥10 tests
│   └── index.ts
```

### Tests Required (≥30 total)

- Politician profile CRUD (T3 isolation) — 8 tests
- FSM transitions (all 6 paths) — 6 tests
- Campaign donation management — 5 tests
- Constituent service requests — 5 tests
- KYC tier guard (Tier 2 required) — 3 tests
- Community space wiring — 3 tests

---

## POS Business Management System

**Critical distinction:** `packages/pos` (existing) = agent float infra (terminal heartbeat, wallet). `packages/verticals-pos-business` = SME business management (inventory, CRM, scheduling).

### Top 15 Features
1. Product catalog and inventory management
2. Stock levels + low-stock alerts
3. Sales point recording (daily reconciliation)
4. Customer database (CRM — name, phone, purchase history)
5. Staff scheduling and shift management
6. Supplier order management
7. Daily / weekly / monthly sales reports
8. Expense tracking
9. Paystack integration for card payments
10. Loyalty program (points per purchase)
11. WhatsApp receipts (via `packages/otp`)
12. Multi-branch management (Places hierarchy)
13. USSD sales entry (*384# for offline)
14. Invoice and receipt generation
15. Agent delegation to staff (workspace members)

### New Schema (Migration 0038)

```sql
CREATE TABLE pos_products (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  tenant_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  sku         TEXT,
  price_kobo  INTEGER NOT NULL,
  stock_qty   INTEGER DEFAULT 0,
  category    TEXT,
  created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_pos_products_tenant ON pos_products(tenant_id);

CREATE TABLE pos_sales (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  tenant_id    TEXT NOT NULL,
  cashier_id   TEXT NOT NULL,
  total_kobo   INTEGER NOT NULL,
  payment_method TEXT NOT NULL,  -- cash|card|transfer
  items_json   TEXT NOT NULL,    -- JSON array of {product_id, qty, price_kobo}
  created_at   INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_pos_sales_tenant ON pos_sales(tenant_id);

CREATE TABLE pos_customers (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  tenant_id   TEXT NOT NULL,
  phone       TEXT,
  name        TEXT,
  loyalty_pts INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_pos_customers_tenant ON pos_customers(tenant_id);
```

---

## M8b Acceptance Criteria

```
[ ] packages/verticals-politician: ≥30 tests passing
[ ] packages/verticals-pos-business: ≥30 tests passing
[ ] Political party, campaign office, LGA office: scaffolded (≥10 tests each)
[ ] Migration 0037 (politician schema) applied to staging
[ ] Migration 0038 (POS business schema) applied to staging
[ ] politics tables (M2) wired to politician FSM
[ ] T3 isolation on ALL new tables
[ ] pnpm -r typecheck — 0 errors
[ ] pnpm -r test — ≥100 new tests (719 baseline + M8a 30 + M8b 100+)
[ ] docs/verticals/politician-brief.md complete
[ ] docs/verticals/pos-business-brief.md complete
```
