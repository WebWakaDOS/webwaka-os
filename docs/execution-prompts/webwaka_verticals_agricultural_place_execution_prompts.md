# WebWaka OS — Verticals Execution Prompts: Agricultural + Place + Markets

**Document type:** Agent execution prompt set  
**Scope:** Agricultural verticals (12) + Place/Market verticals (8)  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Milestone:** M8e (Priority 2 + 3 grouping)  
**Status:** Ready for agent execution after SA Phase 1 pre-verticals are merged

---

### General rules for all agents using these prompts

- **Never make assumptions** about Nigerian agriculture, food systems, or market operations. Always read referenced documents and code first.
- **Agricultural verticals are highly geography-dependent** — state/LGA/ward-level location is critical for farm profiles. Use `packages/core/geography` and the Nigerian 8-level geography hierarchy throughout.
- **Market verticals** (physical markets) involve multi-vendor operations — tenant isolation (T3) applies at both the market operator level AND individual vendor level.
- **All financial values in kobo** (P9, T4) — commodity prices, market levies, warehouse fees, storage charges.
- **USSD is the primary channel** for many agricultural field agents — AI features are excluded from USSD paths (P12). Design with offline/USSD-compatible data entry patterns (no AI) and web/WhatsApp AI features separately.
- **SuperAgent is the AI layer** — all AI routes through `packages/superagent`. Crop advisory AI is advisory only (L2 autonomy) — no autonomous planting or spraying recommendations.
- **Platform Invariants are non-negotiable:** P2, P9, P10, P12, P13, T3.

---

## TASK V-AGR-1: Farm / Smallholder Farmer Vertical

- **Module / vertical:** `packages/verticals` + slug `farm`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Geography package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/core/geography/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Identity package (CAC/land verification): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - AI capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian smallholder agriculture (NIRSAL, CBN Anchor Borrowers Programme, ADP extension services), crop management, and agricultural SaaS platforms, working on WebWaka OS.

**Skills required:**
- Farm profile management — crop types, acreage, LGA-level location
- Crop season and activity tracking — planting, crop care, harvesting schedules
- Input purchase tracking — seeds, fertilizer, agrochemicals (kobo P9)
- Commodity price tracking and offtake recording
- AI-powered crop advisory (L2 autonomy — advisory only, not autonomous action)
- USSD-friendly data entry patterns for field agents (AI excluded from USSD P12)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Agricultural / Farm entry; category breakdown (P2 priority)
- `packages/core/geography/` — state → LGA → ward hierarchy; farm location must be LGA-level minimum
- `packages/payments/` — input purchase payment, produce sale payment
- `docs/governance/ai-integration-framework.md` — agricultural AI use cases (crop advisory, market price intelligence)
- `docs/governance/ai-capability-matrix.md` — capabilities available at Growth tier
- `docs/governance/ai-agent-autonomy.md` — L2 autonomy for agricultural recommendations
- `docs/governance/platform-invariants.md` — P2 (Nigeria First), P9 (kobo), P12 (USSD exclusion critical for farm field agents), P13, T3

---

**2. Online research and execution plan:**

- Research:
  - Nigeria crop calendar by geopolitical zone — planting/harvest seasons for maize, rice, sorghum, cassava, yam
  - Nigerian agricultural input market — NPK fertilizer, herbicide, hybrid seed prices (benchmark in kobo)
  - NIRSAL, BOA, CBN ABP loan program data requirements for farm loan application
  - AI crop advisory patterns — pest identification, disease alert, yield forecasting (Plantix, Hello Tractor patterns)
  - Offline-first farm data entry via USSD: numeric codes for crop types, activities — no AI on USSD (P12)
- Execution plan:
  - **Objective:** Register `farm` vertical; implement farm profile (LGA-located), crop season management, activity log, input purchase tracking, produce sale records, and AI crop advisory + yield forecast via SuperAgent (web/WhatsApp only, never USSD)
  - **Key steps** (numbered)
  - **Risks:** USSD field agents need offline data entry without AI; LGA-level geography dependency; commodity pricing volatility

---

**3. Implementation workflow:**

Branch: `feat/vertical-farm` from `main`.

**3.1 Vertical registration:**
- `farm` in FSM registry; entity type: `individual` (smallholder) or `organization` (commercial farm)
- Lifecycle: `seeded → profile_pending → active`

**3.2 Schema additions:**
```sql
CREATE TABLE farm_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  vertical_id TEXT NOT NULL REFERENCES verticals(id),
  farmer_ref TEXT NOT NULL,
  farm_name TEXT NOT NULL,
  lga_id TEXT NOT NULL,
  ward_id TEXT,
  total_hectares REAL NOT NULL CHECK (total_hectares > 0),
  ownership_type TEXT NOT NULL CHECK (ownership_type IN ('owned', 'leased', 'family', 'communal')),
  primary_crop TEXT NOT NULL,
  secondary_crops JSON NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE TABLE crop_seasons (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farm_profiles(id),
  crop_name TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('wet_main', 'wet_late', 'dry_irrigation')),
  planted_hectares REAL NOT NULL,
  planting_date INTEGER,
  expected_harvest_date INTEGER,
  actual_harvest_date INTEGER,
  yield_kg REAL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'planted', 'growing', 'harvested', 'failed'))
);

CREATE TABLE farm_activities (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES crop_seasons(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('land_prep', 'planting', 'fertilizing', 'weeding', 'pest_control', 'irrigation', 'harvesting', 'other')),
  description TEXT,
  performed_at INTEGER NOT NULL,
  cost_kobo INTEGER NOT NULL DEFAULT 0 CHECK (cost_kobo >= 0),
  created_at INTEGER NOT NULL
);

CREATE TABLE farm_inputs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farm_profiles(id),
  input_type TEXT NOT NULL CHECK (input_type IN ('seed', 'fertilizer', 'herbicide', 'pesticide', 'equipment', 'labour', 'other')),
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_cost_kobo INTEGER NOT NULL CHECK (unit_cost_kobo > 0),
  total_cost_kobo INTEGER NOT NULL CHECK (total_cost_kobo > 0),
  supplier TEXT,
  purchased_at INTEGER NOT NULL
);

CREATE TABLE produce_sales (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farm_profiles(id),
  season_id TEXT REFERENCES crop_seasons(id),
  crop_name TEXT NOT NULL,
  quantity_kg REAL NOT NULL,
  price_per_kg_kobo INTEGER NOT NULL CHECK (price_per_kg_kobo > 0),
  total_amount_kobo INTEGER NOT NULL CHECK (total_amount_kobo > 0),
  buyer_name TEXT,
  payment_ref TEXT,
  sold_at INTEGER NOT NULL
);
```

**3.3 API routes** (`apps/api/src/routes/verticals/farm.ts`):
- `GET/PATCH /v/farm/profile`
- `GET/POST /v/farm/seasons` — crop season management
- `PATCH /v/farm/seasons/:id/status` — FSM status transitions
- `GET/POST /v/farm/seasons/:id/activities` — activity log with cost in kobo
- `GET/POST /v/farm/inputs` — input purchase tracking
- `GET /v/farm/cost-summary?season=` — total input costs in kobo per season
- `GET/POST /v/farm/sales` — produce sale records in kobo
- `GET /v/farm/profit-loss?season=` — gross margin in kobo (sales - inputs - activity costs)
- `POST /v/farm/ai/crop-advisory` — SuperAgent: crop care advisory for current growth stage; blocked on USSD (P12); L2 advisory only
- `POST /v/farm/ai/yield-forecast` — SuperAgent: yield forecast from planted hectares, season type, and historical data

**3.4 USSD exclusion enforcement:**
- All AI routes: hard-check `X-USSD-Session` header → throw `AI_USSD_EXCLUDED` before any AI call (P12)
- Non-AI routes: fully operational on USSD (data entry from field agents)

---

**4. QA and verification:**

Act as a **Senior QA Engineer** with agricultural software testing experience.

**Test plan — minimum 16 test cases:**

Positive:
- Farm profile created with valid LGA ID
- Crop season follows FSM (planned → planted → growing → harvested)
- Activity cost recorded in integer kobo (P9)
- Input purchase in integer kobo; total_cost = quantity × unit_cost (integer arithmetic)
- Produce sale in integer kobo; profit-loss calculation correct in kobo
- Cost summary aggregates in kobo correctly

Negative:
- Fractional kobo in activity cost rejected (P9/T4)
- Season FSM: `harvested → planted` transition rejected
- Yield set on `planned` season rejected (must be at minimum `growing`)

Security:
- AI crop advisory blocked on USSD session (P12) — mandatory test
- AI forecast blocked without NDPR consent (P10)
- Farm data inaccessible cross-tenant (T3)
- Unauthenticated → 401

Recovery:
- AI provider unavailable → returns 503 (not crash); wallet not charged if AI call fails

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/farm): Farm vertical — crop seasons, activities, inputs, produce sales, AI crop advisory (M8e)`
- PR references: platform invariants P9/P12/T3, AI autonomy doc (L2), geography package integration

---

## TASK V-AGR-2: Poultry Farm Vertical

- **Module / vertical:** `packages/verticals` + slug `poultry`
- **Priority:** P2-Top100
- **GitHub context:**
  - (Same core refs as V-AGR-1)

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian poultry industry (NAPOWAN, day-old chick hatcheries, broiler/layer operations), livestock management, and agri-fintech, working on WebWaka OS.

**Skills required:**
- Poultry flock management — batch tracking, mortality recording, feed consumption
- Egg production tracking — daily collection, grading, sales
- Veterinary health management — vaccination schedules, disease alerts
- Feed cost tracking (kobo P9); egg and bird sales (kobo P9)
- AI-powered mortality prediction and feed optimization

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Agricultural / Poultry entry
- (Same geography, payments, and platform invariant refs as V-AGR-1)
- `docs/governance/ai-agent-autonomy.md` — L2 advisory for livestock health AI

---

**2. Online research and execution plan:**

- Research: Nigerian poultry industry — batch cycle (broiler 6-8 weeks, layers 18 months), bird density regulations
- Research: NAFDAC veterinary drug codes for poultry; vaccination schedules (Newcastle, Gumboro, Marek)
- Research: AI in poultry — mortality prediction, feed conversion ratio optimization
- Execution plan: poultry profile, flock batches, daily production log, feed consumption, vet schedule, sales, AI mortality alert

---

**3. Implementation workflow:**

Branch: `feat/vertical-poultry` from `main`.

**Schema:**
- `poultry_profiles` — farm_name, lga_id, poultry_type (`broiler|layer|breeder|mixed`), house_count, licensed_capacity
- `flock_batches` — profile_id, breed, intake_count, intake_date, source, cost_per_bird_kobo, batch_type, status (`growing|sold|completed`)
- `daily_production_logs` — batch_id, log_date, live_count, mortality_count, egg_count (for layers), feed_consumed_kg, water_consumed_litres
- `vet_activities` — batch_id, activity_type (`vaccination|deworming|treatment|inspection`), drug_name, nafdac_code, cost_kobo, performed_at
- `batch_sales` — batch_id, sale_type (`live_bird|egg|carcass`), quantity, price_per_unit_kobo (P9), total_kobo, buyer_name, sold_at

**API routes:**
- `GET/PATCH /v/poultry/profile`
- CRUD `/v/poultry/batches`
- `POST /v/poultry/batches/:id/daily-log`
- `POST /v/poultry/batches/:id/vet`
- `POST /v/poultry/batches/:id/sales`
- `GET /v/poultry/batches/:id/summary` — total costs, sales, FCR
- `POST /v/poultry/ai/mortality-alert` — SuperAgent: flag mortality trend anomaly from daily logs (L2 advisory)
- `POST /v/poultry/ai/feed-optimization` — SuperAgent: feed schedule recommendation from FCR and growth target

---

**4. QA and verification:**

Minimum 14 test cases:
- Daily mortality cannot exceed live count
- Sales quantity cannot exceed live count (for live bird sales)
- All prices in integer kobo (P9)
- AI mortality alert blocked on USSD (P12)
- AI blocked without consent (P10)
- T3 isolation on batch data

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/poultry): Poultry vertical — flock batches, production logs, AI mortality alert (M8e)`

---

## TASK V-AGR-3: Agricultural Aggregator / Off-Taker Vertical

- **Module / vertical:** `packages/verticals` + slug `agri-aggregator`
- **Priority:** P2-Top100
- **GitHub context:**
  - (Same core refs as V-AGR-1)
  - Relationships package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/relationships/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian agricultural aggregation (Thrive Agric, FarmCrowdy, ThriveMarket patterns), offtake agreements, and farmer-market linkage platforms, working on WebWaka OS.

**Skills required:**
- Aggregator operations — farmer enrollment, offtake contracts, collection center management
- Produce collection and grading — weight, quality grades, price per grade (kobo P9)
- Payment disbursement to farmers in kobo (P9)
- Relationship management — aggregator ↔ farmer network via `packages/relationships`
- AI-powered price forecasting and procurement planning

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Agricultural / Aggregator entry
- `packages/relationships/` — aggregator ↔ farmer enrolled relationships
- (All geography, payments, and platform invariant refs as V-AGR-1)

---

**2. Research and execution plan:**

- Research: Nigerian agricultural aggregation models — Wacot, AFEX, Olam Nigeria patterns
- Research: warehouse receipt system (WRS) standards for Nigerian commodity markets
- Research: AI in agricultural procurement — seasonal price forecasting, procurement optimization
- Execution plan: aggregator profile, farmer network enrollment, offtake contracts, produce collection, grading, payment disbursement, AI price forecast

---

**3. Implementation workflow:**

Branch: `feat/vertical-agri-aggregator` from `main`.

**Schema:**
- `aggregator_profiles` — company_name, cac_reg, operating_lgas JSON, crops_handled JSON, collection_center_count
- `enrolled_farmers` — aggregator_id, farmer_ref, enrollment_date, crops_contracted JSON, offtake_quantity_kg
- `collection_events` — aggregator_id, farmer_id, crop_name, quantity_kg, grade (`A|B|C`), price_per_kg_kobo (P9), total_kobo, collection_date, collection_center
- `farmer_payments` — collection_event_id, farmer_id, amount_kobo (P9), payment_ref, paid_at

**API routes:**
- `GET/PATCH /v/agri-aggregator/profile`
- `GET/POST /v/agri-aggregator/farmers` — farmer enrollment
- `POST /v/agri-aggregator/collections` — produce collection and grading
- `GET /v/agri-aggregator/collections?crop=&date=`
- `POST /v/agri-aggregator/payments` — farmer payment disbursement
- `GET /v/agri-aggregator/procurement-summary?crop=&period=` — volumes and costs in kobo
- `POST /v/agri-aggregator/ai/price-forecast` — SuperAgent: forecast commodity price for next 4 weeks from market data

---

**4. QA and verification:**

Minimum 12 test cases — collection prices in kobo (P9), farmer payment in kobo, grade-to-price mapping correct, T3 isolation, AI price forecast blocked on USSD (P12) and without consent (P10).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/agri-aggregator): Agri Aggregator vertical — farmer network, collections, payments, AI price forecast (M8e)`

---

## TASK V-PLC-1: Market / Trading Hub Vertical (Multi-Vendor)

- **Module / vertical:** `packages/verticals` + slug `market`
- **Priority:** P1-Original — M8e
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Geography package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/core/geography/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian market operations (Balogun, Onitsha, Kano markets), market authority management, stall/vendor registration, and levy collection, working on WebWaka OS.

**Skills required:**
- Multi-vendor market management — stall/shop registration, vendor onboarding
- Levy and dues collection (kobo P9) — daily, weekly, annual market levies
- Market authority operations — caretaker/executive management, dispute tracking
- T3 isolation at TWO levels: market operator (workspace) AND individual vendor (sub-scoped)
- AI-powered market traffic analysis and commodity price monitoring

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Place / Market entry (P1-Original, M8e); geography, multi-vendor dependencies
- `packages/core/geography/` — market location at LGA level minimum
- `packages/community/` — market announcements, community spaces for vendor groups
- `docs/governance/platform-invariants.md` — T3 (TWO-level isolation: market operator + vendor scoping), P9, P12

---

**2. Online research and execution plan:**

- Research: Nigerian market authority structures — Market Management Committees (MMC), Lagos LSMS patterns
- Research: Market digitization efforts in Nigeria — ChannelMobilizer, TradeMaster patterns
- Research: AI in market management — footfall prediction, commodity price tracking, levy default alerting
- Execution plan: market profile, section/stall layout, vendor registration, levy collection, dispute management, AI footfall forecast

---

**3. Implementation workflow:**

Branch: `feat/vertical-market` from `main`.

**Schema:**
- `market_profiles` — market_name, lga_id, market_type (`daily|weekly|periodic`), market_days JSON, section_count, stall_count, market_authority_name
- `market_sections` — market_id, section_name, commodity_type, stall_count
- `market_stalls` — section_id, stall_number, stall_type (`open|lock_up|shop`), size_sqm, levy_daily_kobo (P9), levy_annual_kobo
- `market_vendors` — stall_id, vendor_ref, business_name, registration_date, status, guild_affiliation
- `levy_collections` — stall_id, vendor_id, levy_type, amount_kobo (P9), collection_date, collector_ref, payment_ref
- `market_disputes` — market_id, complainant_vendor_id, respondent_vendor_id, description, status, resolved_at

**API routes:**
- `GET/PATCH /v/market/profile`
- CRUD `/v/market/sections`
- CRUD `/v/market/stalls`
- `GET/POST /v/market/vendors`
- `POST /v/market/levies` — record levy collection
- `GET /v/market/levies/summary?date=&section=` — levy revenue in kobo
- `GET/POST /v/market/disputes`
- `POST /v/market/ai/footfall-forecast` — SuperAgent: predict market traffic for tomorrow from historical patterns
- `POST /v/market/ai/price-monitor` — SuperAgent: analyze commodity price trend from vendor-reported prices

---

**4. QA and verification:**

Minimum 16 test cases:
- Levy amounts in integer kobo (P9, T4)
- Daily levy collection aggregates correctly
- Vendor data scoped to market workspace (T3 operator level)
- Individual vendor data not accessible to other vendors (T3 vendor sub-scope)
- AI footfall forecast blocked on USSD (P12) — market agents often use USSD
- AI blocked without consent (P10)
- Dispute creation requires both parties in same market (validation)

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/market): Market vertical — stalls, vendors, levies, disputes, AI footfall forecast (M8e)`

---

## TASK V-PLC-2: Warehouse / Cold Storage Vertical

- **Module / vertical:** `packages/verticals` + slug `warehouse`
- **Priority:** P2-Top100
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Geography package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/core/geography/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian commodity warehousing (AFEX WRS, wet and dry warehouse types), cold chain operations, and warehouse receipt system patterns, working on WebWaka OS.

**Skills required:**
- Warehouse bay/rack management — storage space allocation, occupancy tracking
- Commodity receipt and release — grade, weight, storage fees (kobo P9)
- Cold chain specifics — temperature log (for cold rooms), energy cost tracking
- Warehouse Receipt System (WRS) — receipt issuance for commodity finance
- AI-powered occupancy optimization and spoilage risk alert

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Place / Warehouse entry
- `packages/core/geography/` — warehouse location
- (Same payments, platform invariants as V-PLC-1)

---

**2. Research and execution plan:**

- Research: AFEX WRS standards in Nigeria; CBN collateral management for warehouse receipts
- Research: cold chain temperature requirements for Nigerian commodities (tomatoes, peppers, fish)
- Research: AI in warehousing — spoilage prediction, space utilization optimization
- Execution plan: warehouse profile, storage unit registry, deposit/withdrawal workflow, fee billing, WRS issuance, AI spoilage alert

---

**3. Implementation workflow:**

Branch: `feat/vertical-warehouse` from `main`.

**Schema:**
- `warehouse_profiles` — warehouse_name, lga_id, warehouse_type (`dry|cold|bonded`), total_capacity_tons, current_occupancy_tons, cert_number
- `storage_units` — warehouse_id, unit_code, capacity_tons, commodity_type, temperature_min_c, temperature_max_c
- `storage_deposits` — unit_id, depositor_ref, commodity_name, grade, quantity_kg, fee_per_day_kobo (P9), deposit_date, expected_withdrawal
- `storage_withdrawals` — deposit_id, quantity_kg_withdrawn, withdrawal_date, total_fee_kobo
- `wrs_receipts` — deposit_id, receipt_number, issued_at, value_estimate_kobo, status
- `temperature_logs` — unit_id, temperature_c, recorded_at

**API routes:**
- `GET/PATCH /v/warehouse/profile`
- CRUD `/v/warehouse/units`
- `POST/GET /v/warehouse/deposits`
- `POST /v/warehouse/withdrawals`
- `GET /v/warehouse/receipts` — WRS management
- `POST /v/warehouse/temperature-logs`
- `GET /v/warehouse/revenue?period=` — storage revenue in kobo
- `POST /v/warehouse/ai/spoilage-alert` — SuperAgent: flag spoilage risk from temperature logs + deposit age

---

**4. QA and verification:**

Minimum 12 test cases — storage fees in kobo (P9), withdrawal fee calculated correctly from days × daily rate, occupancy never exceeds capacity, T3 isolation, AI spoilage alert blocked on USSD (P12) and without consent (P10).

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/warehouse): Warehouse vertical — deposits, withdrawals, WRS, AI spoilage alert (M8e)`

---

## TASK V-PLC-3: Tech Hub / Innovation Centre Vertical

- **Module / vertical:** `packages/verticals` + slug `tech-hub`
- **Priority:** P1-Original — M8e
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Community package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/community/
  - Social package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/social/
  - Geography package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/core/geography/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian tech ecosystem (CcHub, Co-Creation Hub, iHub, ALX Nigeria, Ventures Platform hubs), coworking space management, and startup incubation programs, working on WebWaka OS.

**Skills required:**
- Coworking space management — desk/room booking, member access management
- Incubator/accelerator program management — cohorts, mentors, portfolio startups
- Event management — hackathons, pitch days, workshops (via `packages/community`)
- Membership billing (kobo P9) — hot desk, dedicated desk, private office
- AI-powered program impact reporting and member matching

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Place / Tech Hub entry (P1-Original, M8e); geography, community dependencies
- `packages/community/` — hub events, courses (workshops, bootcamps), channels (member channels)
- `packages/social/` — hub public profile, startup showcase
- `packages/core/geography/` — hub location (LGA)

---

**2. Research and execution plan:**

- Research: Nigerian tech hub landscape — CcHub model, Andela campus model, NITDA Innovation Support hubs
- Research: Coworking space management software patterns (Nexudus, OfficeRnD alternatives)
- Research: AI for hub management — member skill matching, program impact reporting, event personalization
- Execution plan: hub profile, space layout, membership plans, booking system, cohort management, AI member matching

---

**3. Implementation workflow:**

Branch: `feat/vertical-tech-hub` from `main`.

**Schema:**
- `tech_hub_profiles` — hub_name, lga_id, hub_type (`coworking|incubator|accelerator|mixed`), capacity, wifi_speed_mbps, open_hours
- `hub_spaces` — hub_id, space_type (`hot_desk|dedicated_desk|meeting_room|event_space`), capacity, daily_rate_kobo, monthly_rate_kobo
- `hub_memberships` — member_ref, plan (`hot_desk|dedicated|private|virtual`), amount_kobo (P9), start_date, end_date, status
- `space_bookings` — space_id, member_ref, date, start_time, end_time, duration_hours, total_kobo, status
- `hub_cohorts` — hub_id, program_name, start_date, end_date, focus_area, startup_count
- `cohort_startups` — cohort_id, startup_ref, stage, sector, progress_notes

**API routes:**
- `GET/PATCH /v/tech-hub/profile`
- CRUD `/v/tech-hub/spaces`
- `POST/GET /v/tech-hub/memberships`
- `POST /v/tech-hub/bookings`
- `GET /v/tech-hub/bookings?date=&space=`
- `GET /v/tech-hub/revenue?period=` — membership + booking revenue in kobo
- CRUD `/v/tech-hub/cohorts`
- `GET/POST /v/tech-hub/cohorts/:id/startups`
- `POST /v/tech-hub/ai/member-matching` — SuperAgent: match new member to existing members by skill/sector
- `POST /v/tech-hub/ai/impact-report` — SuperAgent: draft program impact report from cohort data

---

**4. QA and verification:**

Minimum 14 test cases:
- Membership amounts in kobo (P9)
- Booking overlap validation (same space, same time → conflict)
- Revenue aggregation in kobo
- T3: bookings isolated per hub workspace
- AI member matching uses anonymized skills only (no real names — P13)
- AI blocked without consent (P10)

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/tech-hub): Tech Hub vertical — spaces, memberships, bookings, cohorts, AI member matching (M8e)`

---

## TASK V-AGR-AI: AI Feature Integration Across Agricultural Verticals

- **Module:** Cross-cutting AI for Agricultural category
- **GitHub context:**
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - SuperAgent prompts: `packages/superagent/src/prompts/agricultural.ts` (to be created)
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md (P12 critical)

---

You are an expert **Senior Platform AI Integration Engineer**, working on WebWaka OS.

**Skills required:**
- Agricultural domain AI prompting — Nigerian crop calendar context, geopolitical zone awareness
- USSD exclusion pattern (P12) — critical for agricultural field agents who use USSD
- Advisory-only AI framing (L2) — all agricultural AI must explicitly state it is advisory, not prescriptive

---

**1. Mandatory context reading:**

- `docs/governance/ai-integration-framework.md` — agricultural AI use cases
- `docs/governance/ai-agent-autonomy.md` — L2 advisory constraints for crop/livestock AI
- `docs/governance/platform-invariants.md` — P12 (USSD exclusion), P13 (no farm worker PII to AI)

---

**2. Research and execution plan:**

- Research: crop-specific prompting for Nigerian geopolitical zones (Southwest, Southeast, Northeast, etc.)
- Research: advisory framing patterns for AI crop recommendations (Plantix-style)
- Execution plan: shared agricultural AI utilities with zone-aware prompts and L2 advisory framing

---

**3. Implementation workflow:**

Create `packages/superagent/src/prompts/agricultural.ts`:
- `buildCropAdvisoryPrompt(crop: string, growthStage: string, lga: string, season: string): string` — includes Nigeria zone, rainy/dry season context; MUST include advisory disclaimer
- `buildYieldForecastPrompt(cropHistory: CropHistory[]): string`
- `buildMortalityAlertPrompt(dailyLogs: PoultryLog[]): string`
- `buildPriceForecastPrompt(commodity: string, region: string): string`

All prompts: include `[ADVISORY ONLY — consult your extension agent before acting]` disclaimer; no raw farmer names or NIN (P13); output in simple English with Pidgin option.

All functions in `packages/superagent/src/agricultural-ai.ts`:
- Mandatory USSD check (P12) before any call
- L2 autonomy framing in response metadata

---

**4. QA and verification:**

- USSD session → immediate error before any AI call (P12) — mandatory
- Advisory disclaimer present in all prompt outputs
- No PII in prompts (P13) — verified per function
- At least 10 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(superagent/agricultural): shared agricultural AI prompts with L2 advisory framing and USSD guard`

---

*End of Agricultural + Place + Markets Verticals Execution Prompts.*
*Task blocks: V-AGR-1 (Farm — P2), V-AGR-2 (Poultry — P2), V-AGR-3 (Agri Aggregator — P2), V-PLC-1 (Market — P1), V-PLC-2 (Warehouse — P2), V-PLC-3 (Tech Hub — P1), V-AGR-AI (cross-cutting agricultural AI).*
*Additional agricultural verticals (Cold Room, Palm Oil, Cocoa, Cassava Processing) and place verticals (Community Hall) follow the same template.*
