# WebWaka OS — Verticals Execution Prompts: Transport + Logistics

**Document type:** Agent execution prompt set  
**Scope:** Transport verticals (12) — Motor Park, Mass Transit, Rideshare, Haulage, NURTW, and related  
**Repo:** https://github.com/WebWakaDOS/webwaka-os  
**Branch base:** `main`  
**Milestone:** M8c (all 4 P1-Original transport verticals)  
**Status:** Ready for agent execution after SA Phase 1 pre-verticals are merged

---

### General rules for all agents using these prompts

- **Never make assumptions** about Nigerian transport infrastructure. Always read the referenced documents and code first.
- **Research Nigerian transport context deeply** — FRSC regulations, NURTW structure, mass transit policy, and haulage licensing are domain-specific. Do not generalize from Western patterns.
- **All work must be pushed to GitHub.** No local partial work remains outside the repo.
- **SuperAgent is the AI layer** — all AI features route through `packages/superagent`. Never call AI providers directly.
- **FRSC (Federal Road Safety Corps) integration** is a hard dependency for all transport verticals — vehicle registration, driver licensing, and route licensing require FRSC data. Read `packages/identity/` for integration patterns.
- **Platform Invariants:** P2 (Nigeria First), P9 (integer kobo for all fares and levies), T3 (tenant isolation), P12 (no AI on USSD — critical for roadside/motor park agents).

---

## TASK V-TRN-1: Motor Park / Bus Terminal Vertical

- **Module / vertical:** `packages/verticals` + slug `motor-park`
- **Priority:** P1-Original — must reach production before M10
- **Milestone:** M8c
- **GitHub context:**
  - Verticals master plan: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-master-plan.md
  - Verticals dependency DAG: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/verticals-dependency-dag.md
  - Geography package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/core/geography/
  - Identity package (FRSC): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/
  - Verticals FSM: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/verticals/src/
  - Platform invariants: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/platform-invariants.md
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - Offerings model: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/entitlement-model.md

---

You are an expert **Senior Full-Stack Engineer** with deep knowledge of Nigerian motor park operations (NURTW/NUC structure, park fee collection, vehicle loading management), intercity bus terminals, and transport route management, working on WebWaka OS.

**Skills required:**
- Motor park management — bay/slot assignment, vehicle loading queues, departure scheduling
- NURTW/NUC compliance — union levy collection (kobo P9), membership management
- FRSC integration — vehicle plate verification, driver license checks via `packages/identity`
- Route management — origin, destination, waypoints, fare tables (kobo P9)
- AI-powered occupancy forecasting and dynamic fare suggestion (advisory only, not autonomous pricing)
- Offline-tolerant design — motor park agents often use USSD or feature phones (no AI on USSD paths P12)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Transport / Motor Park entry (P1-Original, M8c); FRSC and geography dependencies
- `docs/governance/verticals-dependency-dag.md` — motor-park node, dependencies and blockers
- `packages/core/geography/` — state → LGA → ward hierarchy used for route origin/destination
- `packages/identity/` — FRSC vehicle registration and driver license verification (read all source files)
- `packages/payments/` — fare payment, levy collection via Paystack
- `docs/governance/ai-integration-framework.md` — transport AI use cases (occupancy forecast, route optimization)
- `docs/governance/ai-capability-matrix.md` — capabilities for transport verticals
- `docs/governance/platform-invariants.md` — P2, P9, P12, T3

---

**2. Online research and execution plan:**

- Research:
  - NURTW structure and park governance in Nigeria — chairman, secretary, financial secretary roles
  - FRSC vehicle registration database API patterns (if available) and offline fallback
  - Nigerian bus terminal operations — loading bay management, departure manifest
  - AI in transport — occupancy prediction, route demand forecasting
  - Offline-first patterns for field agents using USSD ticketing (note: USSD is AI-excluded, P12)
- Execution plan:
  - **Objective:** Register `motor-park` vertical; implement park profile, bay management, vehicle/driver registry with FRSC verification, departure scheduling, fare collection (kobo), levy management, and AI occupancy forecasting
  - **Key steps** (numbered)
  - **Risks:** FRSC API reliability (need offline fallback), NURTW compliance requirements vary by state

---

**3. Implementation workflow:**

Branch: `feat/vertical-motor-park` from `main`.

**3.1 Vertical registration:**
- `motor-park` in FSM registry; entity type: `place`
- Lifecycle: `seeded → park_registered → frsc_verified → active`
- Required: FRSC park/terminal registration

**3.2 Schema additions:**
```sql
CREATE TABLE motor_park_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  vertical_id TEXT NOT NULL REFERENCES verticals(id),
  park_name TEXT NOT NULL,
  park_type TEXT NOT NULL CHECK (park_type IN ('interstate', 'intrastate', 'local')),
  lga_id TEXT NOT NULL,
  state_id TEXT NOT NULL,
  frsc_park_code TEXT,
  nurtw_zone TEXT,
  bay_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE park_routes (
  id TEXT PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES motor_park_profiles(id),
  origin_lga_id TEXT NOT NULL,
  destination_lga_id TEXT NOT NULL,
  fare_kobo INTEGER NOT NULL CHECK (fare_kobo > 0),
  distance_km INTEGER,
  estimated_duration_mins INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE park_vehicles (
  id TEXT PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES motor_park_profiles(id),
  plate_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('bus|mini_bus|car|pickup|truck')),
  capacity INTEGER NOT NULL,
  frsc_verified INTEGER NOT NULL DEFAULT 0,
  driver_name TEXT NOT NULL,
  driver_license TEXT NOT NULL,
  driver_frsc_verified INTEGER NOT NULL DEFAULT 0,
  registered_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_vehicle_plate ON park_vehicles (park_id, plate_number);

CREATE TABLE park_departures (
  id TEXT PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES motor_park_profiles(id),
  route_id TEXT NOT NULL REFERENCES park_routes(id),
  vehicle_id TEXT NOT NULL REFERENCES park_vehicles(id),
  bay_number INTEGER,
  manifest JSON NOT NULL DEFAULT '[]',
  passenger_count INTEGER NOT NULL DEFAULT 0,
  fare_collected_kobo INTEGER NOT NULL DEFAULT 0 CHECK (fare_collected_kobo >= 0),
  departure_status TEXT NOT NULL DEFAULT 'loading' CHECK (departure_status IN ('loading', 'departed', 'cancelled')),
  scheduled_at INTEGER,
  departed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE park_levies (
  id TEXT PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES motor_park_profiles(id),
  vehicle_id TEXT NOT NULL REFERENCES park_vehicles(id),
  levy_type TEXT NOT NULL CHECK (levy_type IN ('union_daily', 'union_annual', 'state_levy', 'local_levy')),
  amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
  payment_ref TEXT,
  collected_at INTEGER NOT NULL
);
```

**3.3 API routes** (`apps/api/src/routes/verticals/motor-park.ts`):
- `GET/PATCH /v/motor-park/profile`
- `GET/POST /v/motor-park/routes` — manage park routes with kobo fares
- `GET/POST /v/motor-park/vehicles` — vehicle registration with FRSC verification trigger
- `POST /v/motor-park/vehicles/:id/verify-frsc` — FRSC plate/license check via `packages/identity`
- `GET/POST /v/motor-park/departures` — create departure (assign vehicle + route + bay)
- `PATCH /v/motor-park/departures/:id/depart` — mark departed with passenger count and fare total
- `POST /v/motor-park/levies` — record levy collection
- `GET /v/motor-park/daily-report?date=` — total departures, fares, and levies for a date
- `POST /v/motor-park/ai/occupancy-forecast` — SuperAgent: predict tomorrow's departure volumes by route from historical data (advisory; not USSD path P12)

**3.4 USSD-exclusion enforcement:**
- All motor-park routes: check `X-USSD-Session` header; if present, return standard JSON response only (no AI features triggered)
- AI routes: hard-blocked if `X-USSD-Session` present (P12)

---

**4. QA and verification:**

Act as a **Senior QA Engineer** with transport and field operations testing experience.

**Test plan — minimum 16 test cases:**

Positive:
- Route created with fare in integer kobo (P9)
- Vehicle registered; FRSC verification status tracked
- Departure created, passenger count updated, fare total in kobo
- Levy recorded in integer kobo (P9)
- Daily report aggregates correctly across multiple departures

Negative:
- Fractional kobo fare rejected (P9/T4)
- Departure with unverified vehicle still allowed (warn, not block — per operational reality)
- Departure marked departed after already departed → 409 conflict

Security:
- AI occupancy forecast blocked on USSD session (P12)
- AI forecast blocked without NDPR consent (P10)
- Cross-park data inaccessible (T3)
- Unauthenticated → 401

Recovery:
- FRSC API unavailable → vehicle registered with `frsc_verified: false`; no crash

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/motor-park): Motor Park vertical — routes, vehicles, departures, levies, AI occupancy forecast (M8c)`
- PR references: verticals master plan P1-Original transport, platform invariants P9/P12/T3, FRSC identity integration

---

## TASK V-TRN-2: City Bus / Mass Transit Vertical

- **Module / vertical:** `packages/verticals` + slug `mass-transit`
- **Priority:** P1-Original — M8c
- **GitHub context:**
  - (Same core refs as V-TRN-1)
  - Offerings model (for route licensing): https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/entitlement-model.md

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian urban mass transit (BRT Lagos, SUBEB buses, Keke NAPEP fleets), route licensing, and fleet management, working on WebWaka OS.

**Skills required:**
- Fleet management at scale — multiple vehicle types, drivers, routes
- Route licensing (state transport authority) — route permit tracking
- Passenger load monitoring — bus stop counts, real-time capacity
- Fare collection — single-journey, daily, weekly passes (all in kobo P9)
- AI-powered route demand analysis and fleet allocation

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Transport / Mass Transit (P1-Original, M8c); FRSC route licensing dependency
- `packages/core/geography/` — route stop geography (ward-level bus stop mapping)
- `packages/identity/` — FRSC vehicle and driver verification
- All V-TRN-1 patterns are reference for shared transport infrastructure

---

**2. Online research and execution plan:**

- Research: Lagos BRT/Blue Rail operations model; Abuja BRT FCTA routes
- Research: Nigerian state transport authority route licensing process
- Research: AI for fleet scheduling — headway optimization, demand-based deployment
- Execution plan: transit profile, route network, bus stops, fleet assignment, daily service logs, AI fleet allocation

---

**3. Implementation workflow:**

Branch: `feat/vertical-mass-transit` from `main`.

**Schema:**
- `transit_profiles` — operator_name, frsc_reg, state_transport_authority_permit, fleet_size
- `transit_routes` — route_code, name, stops JSON (ordered list of stop IDs), fare_kobo (P9), route_permit_number, permit_expiry
- `transit_stops` — stop_name, lga_id, coordinates JSON, route_ids JSON
- `fleet_vehicles` — plate_number, type, capacity, frsc_verified, assigned_route_id, driver_ref
- `service_logs` — route_id, vehicle_id, date, trips_completed, passengers_carried, fare_collected_kobo, incidents JSON

**API routes:**
- CRUD `/v/mass-transit/routes`
- CRUD `/v/mass-transit/stops`
- CRUD `/v/mass-transit/fleet`
- `POST /v/mass-transit/service-logs` — daily service log entry
- `GET /v/mass-transit/performance?route=&period=` — route performance (KPIs in kobo)
- `POST /v/mass-transit/ai/fleet-allocation` — SuperAgent: recommend vehicle deployment by route for tomorrow

---

**4. QA and verification:**

Minimum 12 test cases:
- Fare in integer kobo (P9)
- Route stops stored as ordered array
- Service log totals aggregate in kobo (P9)
- Fleet allocation AI: blocked without consent (P10); blocked on USSD (P12)
- T3 isolation on fleet data

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/mass-transit): Mass Transit vertical — routes, fleet, service logs, AI fleet allocation (M8c)`

---

## TASK V-TRN-3: Rideshare / Carpooling Vertical

- **Module / vertical:** `packages/verticals` + slug `rideshare`
- **Priority:** P1-Original — M8c
- **GitHub context:**
  - (Same core refs as V-TRN-1)
  - OTP package (for driver verification): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/otp/
  - Contact package (for rider/driver contact): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/contact/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian ride-hailing (Bolt, inDriver, Rida patterns), carpooling, and mobility SaaS, working on WebWaka OS.

**Skills required:**
- Driver and rider management — onboarding, KYC, rating systems
- Trip lifecycle FSM — request → matched → en-route → completed | cancelled
- Dynamic fare estimation (kobo, P9) — distance-based pricing
- FRSC driver license and vehicle verification
- AI-powered demand heatmapping and surge advisory

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Transport / Rideshare (P1-Original, M8c); FRSC, offerings.route dependency
- `packages/otp/` — phone OTP for driver/rider phone verification
- `packages/contact/` — contact channel management for trip communication
- `packages/identity/` — FRSC driver license and vehicle registration

---

**2. Online research and execution plan:**

- Research: Bolt and inDriver operational patterns in Nigeria
- Research: FRSC requirements for commercial ride-hailing operators
- Research: AI in ride-hailing — demand forecasting, surge pricing advisory (not autonomous pricing)
- Execution plan: driver profile (FRSC-verified), rider profile, trip lifecycle, fare calculation (kobo), rating system

---

**3. Implementation workflow:**

Branch: `feat/vertical-rideshare` from `main`.

**Schema:**
- `rideshare_drivers` — workspace-scoped, driver_ref, plate_number, vehicle_type, frsc_verified, status (`available|on_trip|offline`)
- `rideshare_riders` — workspace-scoped, rider_ref, rating_avg
- `trips` — driver_id, rider_id, origin_coords JSON, dest_coords JSON, status FSM (`requested→matched→en_route→completed|cancelled`), fare_estimate_kobo, fare_final_kobo, distance_m, duration_secs, completed_at
- `trip_ratings` — trip_id, rater_type (`driver|rider`), rating (1–5), comment

**API routes:**
- `POST/GET /v/rideshare/drivers`
- `POST /v/rideshare/trips/request` — rider requests trip
- `POST /v/rideshare/trips/:id/match` — assign driver
- `PATCH /v/rideshare/trips/:id/status` — en-route → completed
- `POST /v/rideshare/trips/:id/rate`
- `GET /v/rideshare/earnings?driver=&period=` — driver earnings in kobo
- `POST /v/rideshare/ai/demand-heatmap` — SuperAgent: predict high-demand zones for next 2 hours from trip history

---

**4. QA and verification:**

Minimum 12 test cases:
- Fare in integer kobo (P9)
- Trip FSM rejects invalid transitions
- Earnings aggregate in kobo correctly
- Rating bounded 1–5
- AI demand heatmap blocked without consent (P10) and on USSD (P12)

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/rideshare): Rideshare vertical — drivers, trips, ratings, AI demand heatmap (M8c)`

---

## TASK V-TRN-4: Haulage and Logistics Vertical

- **Module / vertical:** `packages/verticals` + slug `haulage`
- **Priority:** P1-Original — M8c
- **GitHub context:**
  - (Same core refs as V-TRN-1)
  - Identity package (FRSC + CAC): https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/identity/
  - Payments package: https://github.com/WebWakaDOS/webwaka-os/blob/main/packages/payments/

---

You are an expert **Senior Full-Stack Engineer** with knowledge of Nigerian haulage and logistics operations (NARTO, Dangote Logistics model, 3PL), freight management systems, and cargo tracking, working on WebWaka OS.

**Skills required:**
- Freight management — waybill generation, cargo tracking, delivery confirmation
- Driver and truck management — FRSC axle load compliance, CAC company registration
- Route costing — fuel cost estimation, toll fees (kobo P9), distance-based freight rates
- Customer and shipper management
- AI-powered route optimization and cost estimation

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/verticals-master-plan.md` — Transport / Haulage (P1-Original, M8c); FRSC, CAC dependencies
- `packages/identity/` — FRSC vehicle/driver and CAC business registration
- `packages/payments/` — freight invoice and payment collection

---

**2. Online research and execution plan:**

- Research: Nigerian haulage regulatory environment — NARTO guidelines, axle load regulations, FRSC haulage licensing
- Research: Logistics management systems in Nigeria — GIGLogistics, Kobo360 patterns
- Research: AI in haulage — route optimization, fuel cost forecasting, predictive maintenance
- Execution plan: company profile (CAC+FRSC), truck fleet, driver registry, waybill management, delivery tracking, AI route costing

---

**3. Implementation workflow:**

Branch: `feat/vertical-haulage` from `main`.

**Schema:**
- `haulage_profiles` — company_name, cac_reg, frsc_fleet_cert, fleet_size, coverage_states JSON
- `haulage_trucks` — workspace-scoped, plate_number, truck_type, capacity_tons, frsc_verified, last_maintenance_at
- `haulage_drivers` — workspace-scoped, driver_ref, license_number, frsc_verified, assigned_truck_id
- `waybills` — origin_lga_id, dest_lga_id, shipper_ref, cargo_description, weight_kg, freight_charge_kobo, status FSM (`created→in_transit→delivered|returned`), truck_id, driver_id
- `delivery_events` — waybill_id, event_type, location_desc, recorded_at, notes

**API routes:**
- CRUD `/v/haulage/trucks`
- CRUD `/v/haulage/drivers`
- `POST/GET /v/haulage/waybills`
- `POST /v/haulage/waybills/:id/events` — delivery event log (en-route checkpoint)
- `PATCH /v/haulage/waybills/:id/deliver` — mark delivered with proof
- `GET /v/haulage/performance?period=` — completed waybills, revenue in kobo
- `POST /v/haulage/ai/route-costing` — SuperAgent: estimate freight cost for origin→destination with current fuel prices and distance

---

**4. QA and verification:**

Minimum 12 test cases:
- Freight charge in integer kobo (P9)
- Waybill FSM transitions are correct
- Delivery events append correctly
- AI route costing blocked without consent (P10); blocked on USSD (P12)
- T3: waybills isolated per workspace

---

**5. Finalize and push to GitHub:**

- Commit: `feat(vertical/haulage): Haulage vertical — fleet, waybills, delivery tracking, AI route costing (M8c)`

---

## TASK V-TRN-AI: AI Feature Integration Across All Transport Verticals

- **Module:** Cross-cutting AI integration for Transport category
- **GitHub context:**
  - AI integration framework: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-integration-framework.md
  - SuperAgent prompts: `packages/superagent/src/prompts/` (to be created)
  - Capability matrix: https://github.com/WebWakaDOS/webwaka-os/blob/main/docs/governance/ai-capability-matrix.md

---

You are an expert **Senior Platform AI Integration Engineer**, working on WebWaka OS.

**Skills required:**
- Transport domain AI prompting — Nigerian route geography context, Pidgin-friendly output
- USSD exclusion enforcement (P12) — all transport AI routes must hard-check session type
- Multi-modal awareness — operators often access via SMS/USSD (AI excluded) vs. web (AI allowed)

---

**1. Mandatory context reading (100% before execution):**

- `docs/governance/ai-integration-framework.md` — transport AI use cases
- `docs/governance/platform-invariants.md` — P12 (USSD exclusion critical for transport field agents)
- All V-TRN-1 through V-TRN-4 implementations

---

**2. Research and execution plan:**

- Research: Nigerian transport geography prompting patterns (route names, popular road names, directional Pidgin)
- Execution plan: shared transport AI utilities in `packages/superagent/src/prompts/transport.ts`

---

**3. Implementation workflow:**

Create `packages/superagent/src/prompts/transport.ts`:
- `buildOccupancyForecastPrompt(routeHistory: RouteHistory[]): string`
- `buildFleetAllocationPrompt(serviceHistory: ServiceHistory[], routes: Route[]): string`
- `buildRouteCostingPrompt(origin: string, dest: string, weight_kg: number): string`

All prompts: include Nigerian geography context; no raw coordinates or driver PII (P13); output in plain English (transport AI is advisory).

Create `packages/superagent/src/transport-ai.ts`:
- `generateOccupancyForecast(workspaceId, data, env): Promise<OccupancyForecast>`
- `generateFleetAllocation(workspaceId, data, env): Promise<FleetAllocation>`
- `generateRouteCost(workspaceId, route, env): Promise<RouteCostEstimate>`

All functions: check `isUssdSession` → throw before any AI call (P12).

---

**4. QA and verification:**

- USSD session → immediate error before any AI call (P12) — mandatory test
- PII-free prompts verified (no plate numbers, NIN, BVN in prompts — P13)
- Credit burn recorded for each AI call
- At least 8 test cases

---

**5. Finalize and push to GitHub:**

- Commit: `feat(superagent/transport): shared transport AI prompts and utilities`

---

*End of Transport + Logistics Verticals Execution Prompts.*
*Task blocks: V-TRN-1 (Motor Park — P1), V-TRN-2 (Mass Transit — P1), V-TRN-3 (Rideshare — P1), V-TRN-4 (Haulage — P1), V-TRN-AI (cross-cutting AI).*
*Additional transport verticals (NURTW chapters, ferry services, motorcycle logistics) follow the same template.*
