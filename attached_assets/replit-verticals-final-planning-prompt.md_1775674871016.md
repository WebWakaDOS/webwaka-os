# Replit Expert Planning Agent: WebWaka Verticals Master Plan (M8+) — ORIGINAL FOCUS + SYNTHESIS

**CLIENT:** WebWakaDOS — Lagos-based multi-vertical SaaS (Nigeria-first)
**PHASE:** M8 Master Planning — Comprehensive Verticals Blueprint
**DEADLINE:** 2026-04-09 18:00 WAT (24 hours)
**OUTPUT:** 12 deliverables → docs/governance/verticals-master-plan.md + CSV seeds + M8–M12 frameworks

## 🚨 ABSOLUTE NON-NEGOTIABLE: ORIGINAL PLANS FIRST

**PHASE 0 (8 HOURS):** Exhaustive repo/docs audit → **ORIGINAL FOCUS AREAS**:

```
1. git clone https://github.com/WebWakaDOS/webwaka-os → main@7cd9c74
2. pnpm install → pnpm -r typecheck
3. EXTRACT ORIGINAL VERTICALS from ALL docs:
   git grep -l -i "vertical\|suite\|commerce\|transport\|civic\|pos\|church\|politician\|ngo\|coop" -- "**/*.md"

   **MANDATORY ORIGINAL FOCUS (do NOT ignore):**
   - Individual Politicians (core/politics → politicalassignments, jurisdictions)
   - Churches (Civic Suite → community spaces ready in M7c)
   - NGOs/Cooperatives (Civic → membership_tiers)
   - Motor Parks/Buses (Transport → route licensing, FRSC)
   - Carpooling/Rides (Transport → offerings.route)
   - POS 3-in-1 (Commerce → BUSINESS MANAGEMENT SYSTEM, NOT financial tx)
     - Inventory, scheduling, customer CRM, agent management
     - NO money transfer focus (existing pos/ is agent infra only)

4. Map ALL mentions → master list:
   docs/planning/m8-phase0-original-verticals.md

   Example:
   ```
   ## Original Planned Verticals (Pre-Top100)
   1. Individual Politicians — core/politics tables ready
   2. Churches — Civic Suite (community spaces/channels/courses)
   3. NGOs/Cooperatives — Civic membership tiers
   4. Motor Parks — Transport (FRSC licensing)
   5. Carpooling — Transport offerings
   6. POS Business Management — Commerce (inventory/CRM, NOT fintech)
   [... ALL extracted]
   ```

5. SYNTHESIZE with Top100 [file:337]:
   - Originals = Priority 1 (100% feature parity)
   - Top100 High-Fit (30+/30) = Priority 2
   - Top100 Medium (20–29) = Priority 3
   - **TOTAL ≥ 150 verticals** (originals + Top100 + research)

**PHASE 0 BLOCKS ALL FORWARD PROGRESS.**
## 🎯 FRAMEWORKS OVER IMPLEMENTATION

**M8 GOAL:** Infra/frameworks → **per-vertical research at implementation time**.

### Infrastructure (M8a — 3 days)
1. verticals table + **150+ seed** (originals first)
2. packages/verticals/ — router, FSM engine, entitlements matrix
3. docs/governance/verticals-research-template.md — **per-vertical brief template**

### Phased Frameworks (M8b–M12)
```
M8b: Original Focus (Politicians/Churches/POS Management — 5 days)
M8c: Transport Verticals (Parks/Carpooling — 5 days)
M8d: Civic Expansion (NGOs/Coops — 5 days)
M8e: Top10 Commerce (Grocery/Logistics — 5 days)
[...]
```
**EACH PHASE:** Framework + 1 sample vertical → template for parallel.

### Per-Vertical Template (Replit generates)
```
docs/templates/vertical-template.md:
Vertical: [Politician Management]
Research: [50+ features from docs/SMEDAN/competitors]
FSM States: [Onboard → Campaign → Election → Office]
Uses Existing: [politics tables, community spaces]
New Package: packages/verticals-politician/
Tests: [≥ 30]
```

## 📋 DELIVERABLES (Grounded in Original Context)

1. `docs/planning/m8-phase0-original-verticals.md` — **ALL originals extracted**
2. `docs/governance/verticals-master-plan.md` — **150+ synthesized** (originals P1)
3. `infra/db/seeds/0004_verticals-master.csv` — **seed-ready**
4. `infra/db/migrations/0036_verticals_table.sql`
5. `packages/verticals/` — router + FSM scaffold
6. `docs/governance/verticals-dependency-dag.md` — Mermaid
7. `docs/templates/vertical-template.md` — **research/implementation template**
8–12. M8a–M12 frameworks (sample verticals only)

## 🏆 SUCCESS
```
✅ PHASE 0: ALL original verticals extracted (politicians/churches/POS mgmt)
✅ 150+ verticals (originals P1, Top100 P2–3)
✅ POS = Business Management (inventory/CRM), NOT fintech
✅ Frameworks enable per-vertical research at impl time
✅ Parallel post-M8a (originals + Top10 any order)
```