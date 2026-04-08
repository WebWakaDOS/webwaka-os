# M8c — Transport Verticals

**Status:** Planning — Blocked by M8a, Parallel to M8b/M8d/M8e
**Author:** Replit Agent (M8 Planning)
**Date:** 2026-04-09
**Duration:** 5 days
**Prerequisite:** M8a complete

---

## Goal

Implement all 6 transport verticals, completing the P1-Original transport mandate. Deliver route licensing infrastructure missing from M6c.

---

## Verticals in Scope (6)

| Vertical | Slug | Entity Type | P1? | Key Dependency |
|---|---|---|---|---|
| Motor Park / Bus Terminal | `motor-park` | place | ✅ P1 | FRSC, geography Facility Place |
| City Bus / Mass Transit | `mass-transit` | organization | ✅ P1 | FRSC, route licensing |
| Carpooling / Ride-Hailing | `rideshare` | organization | ✅ P1 | FRSC, offerings.route |
| Haulage / Logistics Operator | `haulage` | organization | ✅ P1 | FRSC + CAC |
| NURTW / Transport Union | `road-transport-union` | organization | P3 | community platform |
| Okada / Keke Co-op | `okada-keke` | organization | P3 | FRSC, micro-transport |

---

## M8c Infrastructure Addition: Route Licensing

**Missing from platform** (deferred from M6c). Required by Motor Park and Mass Transit verticals.

### Migration 0039: Route Licensing

```sql
CREATE TABLE transport_routes (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  route_name      TEXT NOT NULL,
  origin_place_id TEXT REFERENCES places(id),
  dest_place_id   TEXT REFERENCES places(id),
  route_type      TEXT NOT NULL,    -- intercity|intracity|interstate|international
  license_ref     TEXT,             -- State licensing authority reference
  license_expires INTEGER,          -- Unix epoch
  fare_kobo       INTEGER,          -- Standard fare
  frequency_mins  INTEGER,          -- Average departure interval
  status          TEXT DEFAULT 'pending', -- pending|licensed|suspended|expired
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_routes_tenant ON transport_routes(tenant_id);
CREATE INDEX idx_routes_origin ON transport_routes(origin_place_id);
CREATE INDEX idx_routes_dest   ON transport_routes(dest_place_id);

CREATE TABLE transport_vehicles (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT REFERENCES workspaces(id),
  tenant_id       TEXT NOT NULL,
  route_id        TEXT REFERENCES transport_routes(id),
  plate_number    TEXT NOT NULL,
  vehicle_type    TEXT NOT NULL,    -- bus|minibus|taxi|truck|keke|okada|ferry
  capacity        INTEGER,
  frsc_license    TEXT,             -- Driver/operator FRSC license
  frsc_expires    INTEGER,
  status          TEXT DEFAULT 'active',
  created_at      INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_vehicles_tenant ON transport_vehicles(tenant_id);
CREATE INDEX idx_vehicles_route  ON transport_vehicles(route_id);
```

---

## Sample Vertical: Motor Park / Bus Terminal (Full Implementation)

### Market Research
- Nigeria has ~8,000+ registered motor parks + thousands of informal terminals
- Lagos alone: 650+ registered + 2,000+ informal parks (NURTW)
- NURTW controls levy collection at most parks
- Average park processes 500–5,000 passengers/day

### Top 15 Features
1. Park profile with geography pin (Facility Place)
2. FRSC operator license display + verification
3. Route directory (all routes from this park)
4. Bus arrival/departure schedule
5. Ticket booking (seat reservation)
6. Levy collection tracker (NURTW integration)
7. Passenger count analytics
8. Driver/vehicle registry (FRSC-linked)
9. Park manager workspace (staff + shifts)
10. Safety incident logging
11. USSD arrival board (*384# for low-connectivity passengers)
12. WhatsApp notifications (route delays, arrivals)
13. Revenue per route analytics
14. Stall/kiosk rental management within park
15. Emergency contact directory (FRSC, police, hospital)

### FSM
```
seeded → claimed → frsc_verified → route_licensed → active
                                         ↓
                                     (at least 1 route published)
```

### New Package

```
packages/verticals-motor-park/
├── src/
│   ├── types.ts
│   ├── park.ts              -- Park D1 CRUD (T3)
│   ├── park.test.ts         -- ≥12 tests
│   ├── route.ts             -- Route management + licensing
│   ├── route.test.ts        -- ≥10 tests
│   ├── vehicle.ts           -- Vehicle + driver registry
│   ├── vehicle.test.ts      -- ≥8 tests
│   └── index.ts
```

**Tests Required:** ≥30 per vertical

---

## Rideshare / Carpooling Sample Vertical

### Market Research
- Ride-hailing: Bolt, inDrive active in Lagos, Abuja, PH, Kano
- Carpooling: Emerging for Lagos-Ibadan, Lagos-Ogun corridors
- Drivers: 200,000+ on Bolt Nigeria alone

### Top 15 Features
1. Driver profile + FRSC license verification
2. Route-based carpool offerings (origin + destination)
3. Seat inventory per vehicle
4. Booking + payment (Paystack)
5. Real-time driver location (WebSocket / KV store)
6. Rating system (driver + passenger)
7. Trip history + receipts
8. Safety emergency button (SOS → verified contacts)
9. Driver earnings dashboard
10. Surge pricing (time-of-day + demand)
11. Carpool matching algorithm (route similarity)
12. Group booking (office commute groups)
13. Corporate accounts (B2B)
14. USSD booking fallback (*384#)
15. WhatsApp booking confirmation

---

## M8c Acceptance Criteria

```
[ ] Migration 0039 (transport_routes + transport_vehicles) applied to staging
[ ] packages/verticals-motor-park: ≥30 tests passing
[ ] packages/verticals-transit: ≥30 tests passing
[ ] packages/verticals-rideshare: ≥30 tests passing
[ ] packages/verticals-haulage: ≥20 tests passing (scaffolded)
[ ] NURTW + Okada-Keke: ≥10 tests each (scaffolded)
[ ] FRSC verification wired to all transport verticals
[ ] Route licensing FSM working end-to-end
[ ] T3 on all new tables
[ ] pnpm -r typecheck — 0 errors
[ ] docs/verticals/motor-park-brief.md complete
[ ] docs/verticals/rideshare-brief.md complete
```
