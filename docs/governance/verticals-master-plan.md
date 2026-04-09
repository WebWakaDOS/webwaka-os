# WebWaka OS — Verticals Master Plan (M8+)

**Status:** Draft — M8 Planning
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09
**Phase 0 Source:** `docs/planning/m8-phase0-original-verticals.md`
**Seed:** `infra/db/seeds/0004_verticals-master.csv` (160 verticals)

---

## Strategic Intent

WebWaka OS is built once and reused infinitely. Verticals are the sector-specific activation layers mounted on top of the shared platform core. Each vertical:

1. **Uses existing infrastructure** — geography, entities, auth, community, social, payments, FRSC/CAC identity
2. **Adds per-vertical FSM** — lifecycle states from `seeded` to `active`
3. **Exposes offerings** — products, services, routes, seats, memberships, appointments
4. **Never duplicates shared code** — Platform Invariant P2 (build once)

---

## Priority Framework

| Priority | Label | Count | Requirement |
|---|---|---|---|
| **P1** | Original (pre-Top100) | 17 | 100% feature parity — must implement first |
| **P2** | Top100 High-Fit (≥30/30) | ~80 | High Nigeria SME density and fit |
| **P3** | Top100 Medium (20–29) | ~63 | Valid Nigeria market segments |
| **TOTAL** | | **160** | All seeded in migration 0036 |

---

## Category Breakdown

| Category | Count | Examples |
|---|---|---|
| Commerce | 45 | POS Business Management System, Restaurant, Supermarket, Fashion Brand |
| Transport | 12 | Motor Park, Mass Transit, Rideshare, Haulage, NURTW |
| Civic | 13 | Church, NGO, Cooperative, Mosque, Youth Org, Women's Assoc |
| Politics | 8 | Politician, Party, Campaign Office, LGA Office, Ward Rep |
| Health | 9 | Clinic, Pharmacy, Gym, Dental, Vet, Rehab, CHW Network |
| Education | 8 | School, Driving School, Vocational, Tutoring, Crèche |
| Agricultural | 12 | Farm, Poultry, Cold Room, Aggregator, Palm Oil, Cocoa |
| Professional | 10 | Lawyer/Doctor, Handyman, IT Support, Tax Consultant, Surveyor |
| Creator | 8 | Creator/Influencer, Music Studio, Photography, Fashion Brand |
| Financial | 5 | Savings Group, Insurance Agent, BDC, Mobile Money, Hire Purchase |
| Place | 8 | Market, Wholesale Market, Warehouse, Community Hall, Tech Hub |
| Media | 4 | Community Radio, Newspaper Dist, Podcast Studio, PR Firm |
| Institutional | 3 | Government Agency, Sports Club, Polling Unit |
| Social | 3 | Book Club, Startup, Talent Agency |

---

## Priority 1 — Original Verticals (Full Detail)

These 17 verticals are explicitly designed into the platform DNA. All must reach production before M10.

**Primary Pillar Key:**
- **[1]** = Operations-Management (POS) — `apps/api` + workspace back-office
- **[2]** = Branding / Website / Portal — `apps/brand-runtime` (branded site or storefront)
- **[3]** = Listing / Multi-Vendor Marketplace — `apps/public-discovery` (directory, claim-first)
- **[AI]** = SuperAgent AI features relevant to this vertical (cross-cutting, NOT a 4th pillar)

| # | Slug | Display Name | Entity Type | Primary Pillars | Target Milestone | Key Dependency |
|---|---|---|---|---|---|---|
| 1 | `politician` | Individual Politician | individual | 1, 2, 3 | M8b | politics tables, community |
| 2 | `political-party` | Political Party | organization | 1, 2, 3 | M8b | politics tables, community |
| 3 | `motor-park` | Motor Park / Bus Terminal | place | 1, 3 | M8c | FRSC, geography |
| 4 | `mass-transit` | City Bus / Mass Transit | organization | 1, 3 | M8c | FRSC, route licensing |
| 5 | `rideshare` | Carpooling / Ride-Hailing | organization | 1, 2, 3 | M8c | FRSC, offerings.route |
| 6 | `haulage` | Haulage / Logistics | organization | 1, 2, 3 | M8c | FRSC, CAC |
| 7 | `church` | Church / Faith Community | organization | 1, 2, 3 | M8d | IT-reg, community_spaces |
| 8 | `ngo` | NGO / Non-Profit | organization | 1, 2, 3 | M8d | IT-reg, community_spaces |
| 9 | `cooperative` | Cooperative Society | organization | 1, 3 | M8d | CAC, membership_tiers |
| 10 | `pos-business` | POS Business Management System | organization | 1, 2 | M8b | CAC, inventory schema |
| 11 | `market` | Market / Trading Hub | place | 1, 3 | M8e | geography, multi-vendor |
| 12 | `professional` | Professional (Lawyer/Doctor) | individual | 1, 2, 3 | M8e | license bodies, social |
| 13 | `school` | School / Educational Inst. | organization | 1, 2, 3 | M8e | CAC, community_courses |
| 14 | `clinic` | Clinic / Healthcare Facility | organization | 1, 2, 3 | M8e | CAC, license verification |
| 15 | `creator` | Creator / Influencer | individual | 1, 2, 3 | M8e | social, community, payments |
| 16 | `sole-trader` | Sole Trader / Artisan | individual | 1, 2 | M8e | WhatsApp catalog, social |
| 17 | `tech-hub` | Tech Hub / Innovation Centre | place | 1, 2, 3 | M8e | geography, community |

---

## 3-in-1 Pillar Classification for All 160 Verticals

All verticals default to serving **Pillars 1 and 3** (ops + marketplace/discovery). The full classification is stored in the `primary_pillars` column of the `verticals` D1 table (migration 0037). Below are the classification rules:

| Pillar combination | `primary_pillars` value | Vertical examples |
|---|---|---|
| Ops + Marketplace | `["ops","marketplace"]` | Motor Park, Mass Transit, Cooperative, NURTW, Farm, Savings Group, Polling Unit |
| Ops + Branding | `["ops","branding"]` | POS Business, Sole Trader, Hire Purchase |
| Ops + Marketplace + Branding | `["ops","marketplace","branding"]` | Politician, Party, Church, NGO, Creator, Professional, School, Clinic, Rideshare, Haulage, Tech Hub, Restaurant, Hotel, Pharmacy |

SuperAgent AI capabilities are not represented in `primary_pillars` — they are entitlement-gated and apply across all combinations. See `docs/governance/3in1-platform-architecture.md` for the complete reference.

> **Implementation gate:** `apps/brand-runtime/` (Pillar 2) and `apps/public-discovery/` (Pillar 3) must be scaffolded (PV-1.1, PV-1.2) before M8b begins vertical activation for any Pillar 2 or Pillar 3 dependent vertical.

---

## Infrastructure Requirements per Vertical Category

### Politics Verticals
- `packages/core/politics` — already scaffolded (`.gitkeep` only — needs implementation)
- `political_assignments`, `jurisdictions`, `candidate_records`, `term_records` — D1 tables exist (M2)
- Community spaces (M7c) — campaign management, constituent engagement
- Social network (M7d) — public profile, follower-based outreach

### Transport Verticals
- FRSC verification — `packages/identity/frsc.ts` — already implemented
- Route licensing fields — NOT YET IMPLEMENTED (deferred from M6c)
- Motor park geography — Facility Place type already in geography hierarchy
- POS terminals — `packages/pos` (agent infra) — shared with agent network

### Civic Verticals (Church / NGO / Cooperative)
- CAC Incorporated Trustees (IT-XXXXXXXX) — `packages/identity/cac.ts` — already implemented
- Community spaces + channels + courses + events — M7c — fully implemented
- Membership tiers — `community_members.tier` — already in schema
- Donation/dues collection — needs Paystack integration at vertical layer

### Commerce Verticals (POS Business Management System)
- **Distinct from existing `packages/pos/`** — agent float infrastructure stays separate
- New: inventory table, product catalog, customer CRM, staff scheduling
- Shared: Paystack payments, entitlements, event bus

---

## FSM States (Shared Primitives)

Every vertical lifecycle starts with these shared states from `packages/verticals/src/fsm.ts`:

```
seeded          → Profile exists but not yet claimed
claimed         → Owner has been verified (KYC Tier 1 minimum)
[doc_verified]  → Regulatory document verified (FRSC / CAC / IT / License)
active          → All requirements met — fully operational
suspended       → Temporarily inactive (compliance / non-payment)
deprecated      → Permanently removed from platform
```

Verticals extend this base FSM with sector-specific intermediate states:
- Transport: `frsc_verified`, `route_licensed`
- Church/NGO: `it_verified`, `community_active`
- POS Business: `inventory_setup`
- Education: `courses_published`
- Creator: `social_active`, `monetization_enabled`

---

## Entitlements Matrix (Sample)

| Vertical | Min KYC | FRSC | CAC | IT | Community | Social |
|---|---|---|---|---|---|---|
| Politician | Tier 2 | No | No | No | Yes | Yes |
| Motor Park | Tier 2 | Yes | Yes | No | No | No |
| Church | Tier 1 | No | No | Yes | Yes | No |
| NGO | Tier 1 | No | No | Yes | Yes | No |
| Cooperative | Tier 2 | No | Yes | No | Yes | No |
| POS Business | Tier 1 | No | Yes | No | No | No |
| Clinic | Tier 2 | No | Yes | No | No | No |
| Creator | Tier 1 | No | No | No | Yes | Yes |
| Restaurant | Tier 1 | No | Yes | No | No | No |
| Farm | Tier 1 | No | No | No | No | No |

---

## Implementation Philosophy

### Framework Over Implementation

M8 delivers:
1. **Infrastructure** — verticals table + 160 seeds + `packages/verticals/` FSM engine
2. **Sample vertical per milestone** — one full implementation as template for parallel work
3. **Research template** — `docs/templates/vertical-template.md` for per-vertical briefs
4. **Parallel post-M8a** — any vertical can be built in any order after framework is ready

### Per-Vertical Research Rule

Each vertical gets its own research brief using `docs/templates/vertical-template.md` **at implementation time**, covering:
- Nigerian market size and competitive landscape
- Top 50+ features from competitor and SME research
- SMEDAN / NBS sector data
- Exact table additions needed
- Exact package composition

---

## Milestone Allocation

| Milestone | Theme | P1 Verticals | P2 Sample |
|---|---|---|---|
| M8a | Infrastructure + Seeds | None (framework only) | — |
| M8b | Original Focus — Politics + POS | Politician, Party, Campaign Office, POS Business | — |
| M8c | Transport Verticals | Motor Park, Mass Transit, Rideshare, Haulage, NURTW | — |
| M8d | Civic Expansion | Church, Mosque, NGO, Cooperative, Youth Org | — |
| M8e | P1 Commerce + Creator | Market, Professional, School, Clinic, Creator, Sole Trader, Hub | Restaurant (sample) |
| M9 | Top10 Commerce | — | Restaurant, Hotel, Pharmacy, Grocery, Logistics, Event Hall |
| M10 | Agricultural + Specialist | — | Farm, Poultry, Cold Room, Warehouse, Spa, Beauty Salon |
| M11 | Institutional + Media | — | Govt Agency, Community Radio, Funeral Home |
| M12 | Completion + Parallel Scaling | — | All remaining P2/P3 |

---

## Governance Rules for Verticals

1. **No vertical duplicates shared code.** Every capability routes through `packages/*`.
2. **Per-vertical research brief required before coding.** Use `docs/templates/vertical-template.md`.
3. **FSM states extend base FSM.** Never create an independent state machine.
4. **T3 tenant isolation applies.** All vertical tables require `tenant_id`.
5. **KYC tier enforced at offering activation.** `requireKYCTier()` gates all monetary actions.
6. **NDPR consent before regulatory lookups.** CAC / FRSC / IT lookups require prior consent.
7. **P1 verticals cannot be skipped.** They are the original product design — all must ship before M10.

---

*Last updated: 2026-04-09*
*Source data: `infra/db/seeds/0004_verticals-master.csv` — 160 verticals seeded*
*Migration: `infra/db/migrations/0036_verticals_table.sql`*
