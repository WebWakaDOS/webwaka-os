# M8e — P1 Commerce + Creator Verticals

**Status:** Planning — Blocked by M8a, Parallel to M8b/M8c/M8d
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09
**Duration:** 5 days
**Prerequisite:** M8a complete

---

## Goal

Complete the remaining 7 P1-Original verticals — Market, Professional, School, Clinic, Creator, Sole Trader, and Tech Hub. Include one P2 sample vertical (Restaurant) to establish the M9 commerce template.

---

## Verticals in Scope (8)

| Vertical | Slug | P1? | Key Infrastructure |
|---|---|---|---|
| Market / Trading Hub | `market` | ✅ P1 | Geography Facility Place, multi-vendor |
| Professional | `professional` | ✅ P1 | License body APIs, appointment booking |
| School / Educational Inst. | `school` | ✅ P1 | CAC, community_courses, enrollment |
| Clinic / Healthcare | `clinic` | ✅ P1 | CAC, license verification, appointments |
| Creator / Influencer | `creator` | ✅ P1 | Social, community, Paystack subscriptions |
| Sole Trader / Artisan | `sole-trader` | ✅ P1 | WhatsApp catalogue, social profile |
| Tech Hub | `tech-hub` | ✅ P1 | Geography, community, startup residence |
| Restaurant / Eatery (sample) | `restaurant` | P2 | CAC, menu, booking — M9 template |

---

## Sample Vertical: Creator / Influencer (Full Implementation)

The creator vertical leverages the most M7 infrastructure (social + community + payments) and serves as the flagship M8e implementation.

### Market Research
- Nigeria creator economy: 5M+ active content creators
- Monetization: brand deals (75%), fan subscriptions (15%), merchandise (10%)
- Platforms: Instagram (40M Nigerian users), TikTok (35M), YouTube (25M), Twitter/X
- Pain points: payment collection, audience management, brand deal management, content monetization

### Top 20 Features
1. Creator profile with @handle + social links (M7d social profile)
2. Verified badge (NIN/BVN blue-tick — M7d)
3. Follower-based fan management (M7d social graph)
4. Paid subscription tiers for fans (M7c community + Paystack)
5. Exclusive content channels (M7c community channels)
6. Course creation and monetization (M7c community courses)
7. Brand partnership management (inbound deal tracking)
8. Content calendar and posting schedule
9. Revenue analytics (by stream — subscriptions, tips, brand deals)
10. Fan DM management (M7d DMs)
11. Tips/donations (Paystack one-time)
12. Merchandise store (product catalog)
13. Exclusive NFT / digital product delivery
14. Collaboration requests management
15. Cross-platform analytics import (Instagram, YouTube)
16. WhatsApp broadcast to subscribers
17. USSD fan interaction (*384# for low-connectivity fans)
18. Social post performance analytics
19. Brand deal rate card generator
20. Tax statement generator (for FIRS compliance)

### FSM
```
seeded → claimed → social_active → monetization_enabled → active
```

Transitions:
| From | To | Guard |
|---|---|---|
| `seeded` | `claimed` | `requireKYCTier(1)` + phone verified |
| `claimed` | `social_active` | Social profile created + first post |
| `social_active` | `monetization_enabled` | `requireKYCTier(2)` + BVN verified |
| `monetization_enabled` | `active` | First paid subscription tier created |

### New Schema (Migration 0042)

```sql
CREATE TABLE creator_profiles (
  id                TEXT PRIMARY KEY,
  individual_id     TEXT REFERENCES individuals(id),
  workspace_id      TEXT REFERENCES workspaces(id),
  tenant_id         TEXT NOT NULL,
  social_profile_id TEXT REFERENCES social_profiles(id),
  community_id      TEXT REFERENCES community_spaces(id),
  niche             TEXT,           -- lifestyle|fashion|comedy|tech|finance|food|travel|etc
  follower_count    INTEGER DEFAULT 0,
  verified_brand    INTEGER DEFAULT 0,
  monthly_rate_kobo INTEGER,        -- Brand deal rate card (floor price)
  status            TEXT DEFAULT 'seeded',
  created_at        INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_creator_tenant ON creator_profiles(tenant_id);

CREATE TABLE brand_deals (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  creator_id      TEXT REFERENCES creator_profiles(id),
  brand_name      TEXT NOT NULL,
  deal_value_kobo INTEGER,
  deliverables    TEXT,         -- JSON: [{type, deadline, platform}]
  status          TEXT DEFAULT 'enquiry',  -- enquiry|negotiating|confirmed|delivered|paid
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_brand_deals_tenant   ON brand_deals(tenant_id);
CREATE INDEX idx_brand_deals_creator  ON brand_deals(creator_id);
```

---

## Sole Trader / Artisan Vertical

### Market Research
- Nigeria informal economy: 83M+ workers (NBS 2023)
- Solo artisans: tailors, cobblers, welders, carpenters, painters, plumbers
- Key need: discoverability + WhatsApp catalogue + payment collection

### Top 10 Features
1. Profile with skills + location + WhatsApp number
2. Service catalog (what I offer + price range)
3. Photo portfolio (before/after, work samples)
4. WhatsApp catalogue integration (product/service cards)
5. Booking request form (simple appointment)
6. Rating + review collection
7. Area coverage map (LGA-level geography filter)
8. USSD availability check (*384# for clients)
9. Payment link (Paystack)
10. Referral tracking (word-of-mouth amplifier)

No complex schema needed — uses existing `individuals` + `social_profiles` + `search_entries`.

---

## Restaurant / Eatery (P2 Sample for M9 Template)

Implementing restaurant as M8e sample establishes the template for all 40+ commerce verticals in M9.

### Top 10 Features (Sample Only — Full Research Brief at M9 Timing)
1. Restaurant profile with menu display
2. Table / seating capacity management
3. Online reservation booking
4. Delivery order management
5. Daily special announcements (WhatsApp/Social)
6. Kitchen ticket system
7. Staff management workspace
8. Revenue analytics (per day / per menu item)
9. Customer loyalty (frequent diner program)
10. Paystack payment + split for delivery partners

### New Schema (Migration 0043 — Sample)

```sql
CREATE TABLE restaurant_menus (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  tenant_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  price_kobo  INTEGER NOT NULL,
  category    TEXT,
  available   INTEGER DEFAULT 1,
  photo_url   TEXT,
  created_at  INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_menu_tenant ON restaurant_menus(tenant_id);
```

---

## M8e Acceptance Criteria

```
[ ] packages/verticals-creator: ≥30 tests passing (flagship)
[ ] packages/verticals-sole-trader: ≥20 tests passing
[ ] packages/verticals-market: ≥20 tests passing
[ ] packages/verticals-professional: ≥20 tests passing
[ ] packages/verticals-school: ≥20 tests passing
[ ] packages/verticals-clinic: ≥20 tests passing
[ ] packages/verticals-tech-hub: ≥15 tests passing
[ ] packages/verticals-restaurant: ≥15 tests passing (M9 template)
[ ] All 17 P1-Original verticals now have packages + tests
[ ] Migration 0042 (creator schema) applied to staging
[ ] Social profile + community wired to creator vertical
[ ] Paystack subscription tiers working for creator
[ ] T3 isolation on all new tables
[ ] pnpm -r typecheck — 0 errors
[ ] docs/verticals/creator-brief.md complete
[ ] docs/verticals/restaurant-brief.md complete (M9 template)
```

---

## Milestone Completion: All P1-Original Verticals (Post-M8e)

After M8e, **all 17 P1-Original verticals** are fully implemented:

| # | Vertical | Implemented In |
|---|---|---|
| 1 | Individual Politician | M8b |
| 2 | Political Party | M8b |
| 3 | Motor Park | M8c |
| 4 | Mass Transit | M8c |
| 5 | Rideshare | M8c |
| 6 | Haulage | M8c |
| 7 | Church | M8d |
| 8 | NGO | M8d |
| 9 | Cooperative | M8d |
| 10 | POS Business Mgmt | M8b |
| 11 | Market | M8e |
| 12 | Professional | M8e |
| 13 | School | M8e |
| 14 | Clinic | M8e |
| 15 | Creator | M8e |
| 16 | Sole Trader | M8e |
| 17 | Tech Hub | M8e |

**100% P1-Original coverage achieved. M9+ begins P2/P3 commerce verticals.**
