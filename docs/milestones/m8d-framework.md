# M8d — Civic Expansion: Church / NGO / Cooperative

**Status:** Planning — Blocked by M8a, Parallel to M8b/M8c/M8e
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09
**Duration:** 5 days
**Prerequisite:** M8a complete

---

## Goal

Implement all P1-Original civic verticals (Church, NGO, Cooperative) and their P3 relatives (Mosque, Youth Organization, Women's Association, Ministry/Mission). Leverage M7c community platform as the shared foundation.

---

## Verticals in Scope (6)

| Vertical | Slug | Entity Type | P1? | IT Reg | Community |
|---|---|---|---|---|---|
| Church / Faith Community | `church` | organization | ✅ P1 | Yes (IT-XXXXXXXX) | Yes |
| NGO / Non-Profit | `ngo` | organization | ✅ P1 | Yes (IT-XXXXXXXX) | Yes |
| Cooperative Society | `cooperative` | organization | ✅ P1 | CAC | Yes |
| Mosque / Islamic Centre | `mosque` | organization | P3 | Yes (IT-XXXXXXXX) | Yes |
| Youth Organization | `youth-organization` | organization | P3 | Yes | Yes |
| Women's Association | `womens-association` | organization | P3 | No | Yes |
| Ministry / Apostolic Mission | `ministry-mission` | organization | P3 | Yes | Yes |

---

## Key Infrastructure Note

**M7c Community Platform is COMPLETE and covers 80% of civic vertical needs:**
- `community_spaces` — congregation/member space
- `community_channels` — announcements, prayer requests, programs
- `community_courses` — Sunday school, Bible study, training programs
- `community_events` — services, crusades, fundraisers, AGM
- `community_members` with `tier` — free/paid membership tiers
- Moderation — content governance

**M8d adds the vertical-specific overlay** — registration verification, compliance tracking, and sector-specific features.

---

## Sample Vertical: Church / Faith Community (Full Implementation)

### Market Research
- Nigeria: 100,000+ registered churches (RCCG, MFM, Winners, Anglican, Catholic, etc.)
- Pentecostal density: Lagos (18,000+), Abuja (5,000+), Enugu, Port Harcourt
- Global megachurches with Nigerian origins: RCCG (50M+ members globally)
- Pain points: member management, tithe tracking, attendance, event coordination

### Top 15 Features
1. Church profile with CAC IT number + denomination
2. Community space for congregation (M7c — channels, courses, events)
3. Service schedule (Sunday, mid-week, special programs)
4. Member directory (congregation management)
5. Tithe + offering collection (Paystack)
6. Donation tracking per member (tax-deductible receipts)
7. Prayer request management + pastoral follow-up
8. Announcement broadcasts (WhatsApp + Telegram + SMS)
9. Bible study / discipleship courses (M7c course module)
10. Youth / children's ministry sub-groups
11. Evangelism / outreach team management
12. Anniversary / crusade event ticketing
13. Multi-branch / satellite campus management
14. Pastoral staff workspace + delegated roles
15. Livestream integration (YouTube / Facebook embed)

### FSM
```
seeded → claimed → it_verified → community_active → active
```

Transitions:
| From | To | Guard |
|---|---|---|
| `seeded` | `claimed` | `requireKYCTier(1)` + phone verified |
| `claimed` | `it_verified` | `verifyCAC_IT()` via `packages/identity` |
| `it_verified` | `community_active` | Community space created |
| `community_active` | `active` | First service event published |

### New Schema (Migration 0040)

```sql
CREATE TABLE church_profiles (
  id              TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  community_id    TEXT REFERENCES community_spaces(id),
  it_number       TEXT,             -- IT-XXXXXXXX from CAC
  denomination    TEXT,             -- pentecostal|catholic|anglican|baptist|methodist|others
  founding_year   INTEGER,
  senior_pastor   TEXT,
  total_members   INTEGER DEFAULT 0,
  branch_count    INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'seeded',
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_church_tenant ON church_profiles(tenant_id);

CREATE TABLE tithe_records (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT REFERENCES workspaces(id),
  tenant_id     TEXT NOT NULL,
  member_id     TEXT NOT NULL,
  amount_kobo   INTEGER NOT NULL,
  payment_type  TEXT NOT NULL,  -- tithe|offering|seed|donation|special
  paystack_ref  TEXT,
  recorded_at   INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_tithe_tenant   ON tithe_records(tenant_id);
CREATE INDEX idx_tithe_member   ON tithe_records(member_id);
```

### Package

```
packages/verticals-church/
├── src/
│   ├── types.ts
│   ├── church.ts          -- Church profile D1 CRUD (T3)
│   ├── church.test.ts     -- ≥12 tests
│   ├── tithe.ts           -- Offering + tithe collection + Paystack
│   ├── tithe.test.ts      -- ≥10 tests
│   ├── service.ts         -- Service scheduling (wraps community_events)
│   ├── service.test.ts    -- ≥8 tests
│   └── index.ts
```

---

## Cooperative Society Vertical

### Market Research
- Nigeria has 10,000+ registered cooperatives (FCA, CSNL)
- Types: savings/credit, consumer, agricultural, multi-purpose
- Pain points: contribution tracking, loan management, member voting, annual accounts

### Top 15 Features
1. Cooperative profile with CAC registration
2. Member enrollment + shares registry
3. Monthly contribution (ajo/esusu) tracking
4. Loan application + approval workflow
5. Loan repayment schedule + reminders
6. Member voting (elections, resolutions)
7. Annual general meeting (AGM) management
8. Dividend calculation + distribution
9. Balance sheet + income statement generator
10. Compliance filing calendar (FCA returns)
11. Guarantor management for loans
12. Multi-tier membership (ordinary, associated, honorary)
13. WhatsApp contribution reminders
14. USSD contribution entry (*384# for low-connectivity members)
15. Audit trail for all financial transactions

### New Schema (Migration 0041)

```sql
CREATE TABLE cooperative_members (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  member_number   TEXT UNIQUE NOT NULL,
  shares_count    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active',  -- active|suspended|exited
  joined_at       INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_coop_member_tenant ON cooperative_members(tenant_id);

CREATE TABLE cooperative_contributions (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT REFERENCES workspaces(id),
  tenant_id     TEXT NOT NULL,
  member_id     TEXT REFERENCES cooperative_members(id),
  amount_kobo   INTEGER NOT NULL,
  cycle_month   TEXT NOT NULL,   -- YYYY-MM
  paystack_ref  TEXT,
  status        TEXT DEFAULT 'pending',
  created_at    INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_coop_contrib_tenant ON cooperative_contributions(tenant_id);
CREATE INDEX idx_coop_contrib_member ON cooperative_contributions(member_id);

CREATE TABLE cooperative_loans (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  member_id       TEXT REFERENCES cooperative_members(id),
  amount_kobo     INTEGER NOT NULL,
  interest_rate   INTEGER NOT NULL,   -- basis points (500 = 5%)
  duration_months INTEGER NOT NULL,
  status          TEXT DEFAULT 'pending', -- pending|approved|active|repaid|defaulted
  guarantor_id    TEXT,
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_coop_loan_tenant ON cooperative_loans(tenant_id);
```

---

## M8d Acceptance Criteria

```
[ ] packages/verticals-church: ≥30 tests passing
[ ] packages/verticals-ngo: ≥30 tests passing
[ ] packages/verticals-cooperative: ≥30 tests passing
[ ] Mosque, Youth Org, Women's Assoc: scaffolded (≥10 tests each)
[ ] Migration 0040 (church schema) applied to staging
[ ] Migration 0041 (cooperative schema) applied to staging
[ ] CAC IT verification wired to church + NGO + cooperative FSMs
[ ] M7c community_spaces wired to church + NGO + cooperative
[ ] Paystack tithe/donation collection working end-to-end
[ ] T3 isolation on all new tables
[ ] pnpm -r typecheck — 0 errors
[ ] docs/verticals/church-brief.md complete
[ ] docs/verticals/cooperative-brief.md complete
```
