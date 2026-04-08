# M9–M12 Verticals Expansion Framework

**Status:** Planning — Blocked by M8e completion (all P1 verticals)
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09

---

## Framework Philosophy

M9–M12 implement P2 and P3 verticals in order of Nigeria market density and revenue potential. Each milestone follows the same pattern:

1. Complete per-vertical research brief (`docs/templates/vertical-template.md`)
2. Scaffold package (`packages/verticals-{slug}/`)
3. Implement with ≥30 tests
4. Wire to API routes
5. Apply D1 migrations

All P2/P3 verticals share infrastructure established in M8a:
- `packages/verticals` FSM engine
- Migration 0036 registry
- `docs/templates/vertical-template.md`

---

## M9 — Top10 Commerce (P2 High-Fit)

**Duration:** 15 days (3 days per vertical × 5 verticals)
**Prerequisite:** All M8 milestones complete (all 17 P1 verticals done)

### Target Verticals (5 full + 5 scaffolded)

**Full implementations (≥30 tests each):**

| # | Vertical | Slug | Key Feature Cluster |
|---|---|---|---|
| 1 | Restaurant / Eatery | `restaurant` | Menu + table booking + delivery + kitchen tickets |
| 2 | Hotel / Guesthouse / Shortlet | `hotel` | Room inventory + booking calendar + Airbnb-style |
| 3 | Pharmacy | `pharmacy` | NAFDAC regulation + prescription management + stock |
| 4 | Supermarket / Grocery | `supermarket` | Product catalog + stock + delivery + loyalty |
| 5 | Logistics & Delivery | `logistics-delivery` | Parcel tracking + rider network + COD |

**Scaffolded (≥10 tests each — full brief for M10):**

| # | Vertical | Slug |
|---|---|---|
| 6 | Savings Group / Ajo | `savings-group` |
| 7 | Gas / LPG Distributor | `gas-distributor` |
| 8 | Beauty Salon / Barber | `beauty-salon` |
| 9 | Event Hall | `event-hall` |
| 10 | Training Institute | `training-institute` |

### M9 Infrastructure Additions

```sql
-- Migration 0050+: M9 verticals
-- Shared delivery schema (used by logistics + supermarket + restaurant)
CREATE TABLE delivery_orders (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  origin_address  TEXT NOT NULL,
  dest_address    TEXT NOT NULL,
  rider_id        TEXT,
  status          TEXT DEFAULT 'pending',
  fee_kobo        INTEGER,
  cod_amount_kobo INTEGER DEFAULT 0,
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_delivery_tenant ON delivery_orders(tenant_id);

-- Shared reservation schema (hotel + restaurant + event hall)
CREATE TABLE reservations (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  vertical_slug   TEXT NOT NULL,  -- 'hotel' | 'restaurant' | 'event-hall'
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  resource_id     TEXT NOT NULL,  -- room_id or table_id or slot_id
  check_in        INTEGER,
  check_out       INTEGER,
  guests_count    INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'pending',
  paystack_ref    TEXT,
  amount_kobo     INTEGER,
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_reservations_tenant   ON reservations(tenant_id);
CREATE INDEX idx_reservations_vertical ON reservations(vertical_slug);
```

### M9 Acceptance Criteria

```
[ ] 5 full vertical implementations (restaurant, hotel, pharmacy, supermarket, logistics)
[ ] 5 scaffolded verticals (≥10 tests each)
[ ] Shared delivery + reservation schemas applied
[ ] All M9 verticals wired to GET /verticals/:slug API
[ ] NAFDAC license mock for pharmacy
[ ] Hotel booking calendar end-to-end test
[ ] pnpm -r test — ≥200 new tests (total ≥1,000)
[ ] pnpm -r typecheck — 0 errors
```

---

## M10 — Agricultural + Specialist Verticals

**Duration:** 15 days
**Prerequisite:** M9 complete

### Target Verticals (5 full)

| # | Vertical | Slug | Key Complexity |
|---|---|---|---|
| 1 | Farm / Agricultural Producer | `farm` | Harvest calendar + buyer marketplace + cold chain |
| 2 | Poultry Farm / Aquaculture | `poultry-farm` | Flock management + feed tracking + market linkage |
| 3 | Cold Room / Storage | `cold-room` | Slot booking + temperature monitoring + produce tracking |
| 4 | Auto Mechanic / Garage | `auto-mechanic` | Job cards + parts inventory + FRSC vehicle check |
| 5 | Warehouse Operator | `warehouse` | Inventory slots + client billing + receiving/dispatch |

**Plus 10 additional scaffolded (≥10 tests each):**
Furniture maker, Welding shop, Printing & branding, Electronics repair, Gym, Spa, Dental clinic, Optician, Sports academy, Florist

### Agricultural Infrastructure

```sql
-- Migration 0060+: M10 agricultural
CREATE TABLE farm_harvests (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  crop_type       TEXT NOT NULL,
  quantity_kg     INTEGER NOT NULL,
  harvest_date    INTEGER,
  grade           TEXT,       -- A|B|C|export
  asking_price_kobo INTEGER,
  status          TEXT DEFAULT 'available',
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_harvests_tenant ON farm_harvests(tenant_id);
CREATE INDEX idx_harvests_crop   ON farm_harvests(crop_type);
```

---

## M11 — Institutional + Media Verticals

**Duration:** 10 days
**Prerequisite:** M10 complete

### Target Verticals (3 full + 5 scaffolded)

**Full implementations:**

| # | Vertical | Slug | Complexity |
|---|---|---|---|
| 1 | Community Radio / TV | `community-radio` | NBC license + programming schedule + community notices |
| 2 | Government Agency / Parastatal | `government-agency` | Public service directory + complaint management |
| 3 | Funeral Home | `funeral-home` | Service packages + memorial pages + logistics |

**Scaffolded:**
- Orphanage / Child Care NGO
- Elderly Care Facility
- Rehabilitation Centre
- Book Club
- Community Hall

---

## M12 — Completion + Parallel Scaling

**Duration:** Ongoing
**Prerequisite:** M11 complete

### Objective

Complete all remaining P2 and P3 verticals from the 160 seeded in migration 0036. By M12, WebWaka OS has:

- All 17 P1-Original verticals: **100% feature parity** ✅ (M8b–M8e)
- Top 50 P2 High-Fit verticals: **full implementation** ✅ (M9–M12)
- Top 30 P3 Medium verticals: **scaffolded + partial** ✅ (M9–M12)
- Remaining 60+ P3 verticals: **seeded in registry + research briefs** ✅

### Parallelization Pattern

At M12, multiple implementation agents work in parallel on isolated vertical packages:

```
Agent A → packages/verticals-bureau-de-change/
Agent B → packages/verticals-used-car-dealer/
Agent C → packages/verticals-building-materials/
...
```

Each agent uses `docs/templates/vertical-template.md` and the established package pattern.

### M12 Platform Targets

```
Total tests: ≥2,500
Total verticals with full implementation: ≥50
Total verticals seeded in registry: 160
Zero TypeScript errors across all packages
All P1-Original verticals at ≥30 tests each
Average test coverage per vertical: ≥30 tests
```

---

## Cross-Milestone Shared Infrastructure

Infrastructure built in one milestone and shared across M9–M12:

| Infrastructure | Built In | Used By |
|---|---|---|
| Shared delivery schema | M9 | Logistics, Restaurant, Supermarket, Pharmacy |
| Shared reservation schema | M9 | Hotel, Restaurant, Event Hall, Sports Academy |
| Farm harvest marketplace | M10 | Farm, Poultry, Cassava Miller, Produce Aggregator |
| Government service schema | M11 | Govt Agency, LGA Office, Ward Office |
| Memorial page schema | M11 | Funeral Home, Orphanage |

---

*Generated: 2026-04-09 — docs/governance/verticals-master-plan.md*
*Seed data: infra/db/seeds/0004_verticals-master.csv — 160 verticals*
