# M8 Phase 0 — Original Planned Verticals (Pre-Top100 Audit)

**Status:** Complete — Phase 0 Audit
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09
**Source:** Exhaustive audit of `main@08850da` — all governance docs, migrations, packages, attached briefs

---

## Audit Method

```
git grep -l -i "vertical|suite|commerce|transport|civic|pos|church|politician|ngo|coop" -- "**/*.md"
→ 70 markdown files scanned
→ packages/politics/, packages/pos/, packages/offerings/ inspected
→ All 35 D1 migrations reviewed (0001–0035)
→ All 29 packages scanned for vertical scaffolding
```

---

## Original Planned Verticals (Pre-Top100)

These verticals are explicitly mentioned in governance documents, architecture decisions, milestone briefs, or existing package scaffolding **before** any Top100 research list was consulted. They carry **Priority 1** status and require **100% feature parity** at M8+.

### 1. Individual Politician — `core/politics` tables ready

**Evidence:**
- `docs/governance/political-taxonomy.md` — full 7-office model (Councilor → President)
- `packages/core/politics/.gitkeep` — scaffolded, awaiting implementation
- D1 migrations 0001–0006 include `political_assignments`, `jurisdictions`, `candidate_records`, `term_records`
- `docs/architecture/decisions/0011-geography-and-political-core.md` — "built before any vertical"
- `docs/governance/relationship-schema.md` — `holds_office`, `jurisdiction_over` relationships exist

**Political Offices Ready:**
| Office | Territory |
|---|---|
| Councilor | Ward |
| LGA Chairman | LGA |
| State Assembly Member | State Constituency |
| HoR Member | Federal Constituency |
| Senator | Senatorial District / Zone |
| Governor | State |
| President | Country |

**Target Package:** `packages/verticals-politician/`
**FSM States:** `Seeded → Claimed → Candidate → Elected → InOffice → PostOffice`

---

### 2. Political Party — Organization subtype

**Evidence:**
- `docs/governance/political-taxonomy.md` — "Party Affiliation: Association between Individual and political party"
- `docs/governance/universal-entity-model.md` — "Party as Organization subtype"
- `docs/governance/relationship-schema.md` — `affiliated_with` relationship type

**Target Package:** `packages/verticals-political-party/`
**FSM States:** `Seeded → Claimed → Registered → Active`

---

### 3. Motor Park / Bus Terminal — Facility Place, FRSC-linked

**Evidence:**
- `docs/governance/geography-taxonomy.md` — "Motor park" listed as Facility Place type
- `docs/governance/geography-taxonomy.md` — "All motor parks in a senatorial zone" required query
- `docs/identity/frsc-cac-integration.md` — transport operators require FRSC verification
- `packages/pos/src/terminal.ts` — POS terminal registration for park agents

**Target Package:** `packages/verticals-motor-park/`
**FSM States:** `Seeded → Claimed → FRSCVerified → Active → Suspended`

---

### 4. City Bus / Mass Transit Operator — Transport, FRSC

**Evidence:**
- `docs/identity/frsc-cac-integration.md` — "bus companies, haulage, ride-hailing activating route management"
- `docs/governance/milestone-tracker.md` — "Route licensing fields (transport) — NOT STARTED"
- `docs/governance/milestone-tracker.md` (M6c) — "Route licensing fields (transport)"

**Target Package:** `packages/verticals-transit/`
**FSM States:** `Seeded → Claimed → FRSCVerified → RouteLicensed → Active`

---

### 5. Carpooling / Ride-Hailing Service — Transport, offerings.route

**Evidence:**
- `attached_assets/0bbbc5254_milestone3-replit-brief_1775578520960.md` — "No vertical-specific packages (`packages/ride-hailing`, etc.)" — explicitly listed as deferred future scope
- `docs/governance/universal-entity-model.md` — Offerings include "routes, seats"
- `docs/governance/relationship-schema.md` — `offers` relationship type

**Target Package:** `packages/verticals-rideshare/`
**FSM States:** `Seeded → Claimed → FRSCVerified → Active`

---

### 6. Haulage / Logistics Operator — Transport, FRSC

**Evidence:**
- `docs/identity/frsc-cac-integration.md` — "bus companies, haulage, ride-hailing"
- `packages/identity` — FRSC verification already implemented

**Target Package:** `packages/verticals-haulage/`
**FSM States:** `Seeded → Claimed → FRSCVerified → CACVerified → Active`

---

### 7. Church / Faith Community — IT-registration, community_spaces

**Evidence:**
- `docs/governance/universal-entity-model.md` — "Collective entities such as … churches"
- `docs/identity/frsc-cac-integration.md` — "Incorporated Trustees (NGOs/churches): IT-XXXXXXXX"
- M7c: `community_spaces`, `community_channels`, `community_courses`, `community_events` all implemented — directly maps to church community management
- `docs/community/community-model.md` — "any Organisation … can spin up a structured community"

**Target Package:** `packages/verticals-church/`
**FSM States:** `Seeded → Claimed → ITVerified → CommunityActive → Active`

---

### 8. NGO / Non-Profit Organization — IT-registration, community membership_tiers

**Evidence:**
- `docs/governance/universal-entity-model.md` — Organizations include NGOs
- `docs/identity/frsc-cac-integration.md` — Incorporated Trustees (IT-XXXXXXXX) for NGOs
- `docs/community/community-entitlements.md` — membership_tiers for paid community access

**Target Package:** `packages/verticals-ngo/`
**FSM States:** `Seeded → Claimed → ITVerified → ProgramsActive → Active`

---

### 9. Cooperative Society — IT-registration, membership_tiers

**Evidence:**
- `docs/governance/universal-entity-model.md` — Organizations include cooperatives (implied in "collective entities")
- `docs/governance/milestone-tracker.md` (M6c) — "Cooperative Savings & Loan" scoped
- `docs/community/community-model.md` — membership tiers apply to cooperatives

**Target Package:** `packages/verticals-cooperative/`
**FSM States:** `Seeded → Claimed → CACVerified → MembersEnrolled → Active`

---

### 10. POS Business Management System — inventory/CRM/scheduling (NOT agent fintech)

**Evidence:**
- `packages/pos/src/terminal.ts` — **current pos/ is agent infrastructure only** (float-ledger, wallet, terminal heartbeat)
- Original vision: POS 3-in-1 = Business Management System
- `docs/governance/vision-and-mission.md` — "operational management and workflows"
- `docs/governance/milestone-tracker.md` (M6c) — mentions commerce layer as separate from agent pos

**Clarification:** The existing `packages/pos/` covers **agent network infrastructure**. The POS Business Management System vertical is a **separate** vertical for small businesses using a POS terminal as their operational hub — managing inventory, staff shifts, customer CRM, daily sales reports, and supplier orders. No money transfer focus.

**Target Package:** `packages/verticals-pos-business/`
**FSM States:** `Seeded → Claimed → CACVerified → InventorySetup → Active`

---

### 11. Market / Trading Hub — Facility Place, multi-vendor

**Evidence:**
- `docs/governance/geography-taxonomy.md` — "Market" listed as Facility Place type
- `docs/governance/geography-taxonomy.md` — "All markets in an LGA" as required query
- `docs/governance/vision-and-mission.md` — "seed and grow structured directories and marketplaces"

**Target Package:** `packages/verticals-market/`
**FSM States:** `Seeded → Claimed → Active → VendorsEnrolled`

---

### 12. Professional (Lawyer, Doctor, Accountant, Engineer) — Individual subtype

**Evidence:**
- `docs/governance/universal-entity-model.md` — "professionals" listed as Individual subtype
- `docs/governance/vision-and-mission.md` — "professional use cases"

**Target Package:** `packages/verticals-professional/`
**FSM States:** `Seeded → Claimed → LicenseVerified → Active`

---

### 13. School / Educational Institution — Organization subtype

**Evidence:**
- `docs/governance/universal-entity-model.md` — "schools" listed as Organization subtype
- `docs/governance/geography-taxonomy.md` — "Campus" as Facility Place
- M7c community_courses — directly reusable for school course catalog

**Target Package:** `packages/verticals-school/`
**FSM States:** `Seeded → Claimed → CACVerified → CoursesPublished → Active`

---

### 14. Clinic / Healthcare Facility — Organization subtype

**Evidence:**
- `docs/governance/universal-entity-model.md` — "clinics" listed as Organization subtype
- `docs/governance/geography-taxonomy.md` — "Clinic" as Facility Place

**Target Package:** `packages/verticals-clinic/`
**FSM States:** `Seeded → Claimed → LicenseVerified → Active`

---

### 15. Creator / Influencer — Individual subtype

**Evidence:**
- `docs/governance/universal-entity-model.md` — "creators" listed as Individual subtype
- M7c+M7d: Social network + community platform fully operational as creator tools
- `docs/governance/vision-and-mission.md` — "creator … use cases"

**Target Package:** `packages/verticals-creator/`
**FSM States:** `Seeded → Claimed → SocialActive → MonetizationEnabled → Active`

---

### 16. Sole Trader / Artisan — Individual subtype

**Evidence:**
- `docs/governance/universal-entity-model.md` — "sole traders" listed as Individual subtype
- Core to Nigeria informal economy

**Target Package:** `packages/verticals-sole-trader/`
**FSM States:** `Seeded → Claimed → Active`

---

### 17. Tech Hub / Innovation Centre — Facility Place

**Evidence:**
- `docs/governance/geography-taxonomy.md` — "Hub" as Facility Place type
- WebWaka OS itself is Lagos-based tech ecosystem context

**Target Package:** `packages/verticals-hub/`
**FSM States:** `Seeded → Claimed → MembersEnrolled → Active`

---

## Summary Table

| # | Vertical | Priority | Tables Ready | Package Scaffold |
|---|---|---|---|---|
| 1 | Individual Politician | P1-Original | political_assignments, jurisdictions | `.gitkeep` |
| 2 | Political Party | P1-Original | organizations table | none |
| 3 | Motor Park / Bus Terminal | P1-Original | places (Facility), pos_terminals | none |
| 4 | City Bus / Mass Transit | P1-Original | — | none |
| 5 | Carpooling / Ride-Hailing | P1-Original | offerings table | listed as deferred |
| 6 | Haulage / Logistics | P1-Original | — | none |
| 7 | Church / Faith Community | P1-Original | community_spaces, channels, courses | none |
| 8 | NGO / Non-Profit | P1-Original | community_spaces, membership_tiers | none |
| 9 | Cooperative Society | P1-Original | community_spaces | none |
| 10 | POS Business Mgmt System | P1-Original | pos_terminals (agent-only now) | packages/pos (wrong scope) |
| 11 | Market / Trading Hub | P1-Original | places (Facility) | none |
| 12 | Professional | P1-Original | individuals table | none |
| 13 | School / Educational Inst. | P1-Original | organizations, community_courses | none |
| 14 | Clinic / Healthcare | P1-Original | organizations, places | none |
| 15 | Creator / Influencer | P1-Original | social_profiles, community_spaces | none |
| 16 | Sole Trader / Artisan | P1-Original | individuals table | none |
| 17 | Tech Hub | P1-Original | places (Facility) | none |

**TOTAL P1-Original Verticals:** 17 (all extracted from repo audit)

---

## Existing Infrastructure Ready for Verticals

All verticals can draw on:

| Infrastructure | Package / Migration | Notes |
|---|---|---|
| Politics tables | M2 migrations (0001–0006) | offices, assignments, jurisdictions, terms, candidates |
| Community spaces | M7c migrations (0026–0030) | channels, courses, events, moderation |
| Social network | M7c migrations (0031–0034) | profiles, posts, groups, DMs, feed |
| POS agent infra | M7b migrations (0022–0025) | float-ledger, wallet, terminal, sessions |
| CAC verification | `packages/identity/cac.ts` | Prembly IT/RC/BN number |
| FRSC verification | `packages/identity/frsc.ts` | Driver/operator license |
| OTP multi-channel | `packages/otp` | SMS/WhatsApp/Telegram/Email |
| Geography 8-level | `packages/geography` | Country → Facility Place |
| Entitlements | `packages/entitlements` | KYC tier + subscription guards |
| Contact channels | `packages/contact` | P12/P13 consent guards |
| Event bus | `packages/events` | publishEvent, subscribe, projections |
| Payments | `packages/payments` | Paystack checkout + webhook |
| USSD gateway | `apps/ussd-gateway` | AfricasTalking + Telegram webhook |
| i18n | `packages/frontend/src/i18n/` | pcm + en strings |

---

*This document is the authoritative Phase 0 output. It BLOCKS all forward progress on M8.*
*Next: docs/governance/verticals-master-plan.md — 150+ verticals synthesized.*
