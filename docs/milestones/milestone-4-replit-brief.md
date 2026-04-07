# WebWaka OS — Milestone 4 Replit Brief

**Prepared by:** Base44 Super Agent (OpenClaw)
**Date:** 2026-04-07, 20:31 WAT
**Milestone:** 4 — Discovery Layer MVP
**Status:** ACTIVE — Founder approved Milestone 3 at 20:31 WAT today

---

## Context

Milestone 3 delivered the vertical package scaffolding and first API wiring:
- `@webwaka/entities` — full CRUD layer against D1 (all 7 root entities)
- `@webwaka/entitlements` — plan config matrix + evaluation engine + guards
- `@webwaka/relationships` — typed relationship graph + D1 migration 0007
- `@webwaka/offline-sync` — type contracts (scaffold only)
- `@webwaka/ai` — AI provider abstraction types (scaffold only)
- `apps/api` — Hono Worker with 12 wired routes across /health, /auth, /geography, /entities
- Issue #8 resolved: 775 LGA seed + 8,810 ward seed committed
- Issues #11 & #12 resolved: `buildIndexFromD1` + `CandidateRecord.id` + political constraint migration
- **151 tests, 0 failures | 11 packages typecheck clean**

Milestone 4 builds the **first user-facing layer**: public discovery of seeded entities, geography-filtered search, public profile hydration, and capture of claim intent. No authentication required for discovery endpoints.

---

## Repo State You Are Starting From

**Branch:** `main`
**HEAD:** `f539a6b`
**Baseline:** All 151 tests pass. All 11 packages typecheck clean.

**BRANCH DISCIPLINE — READ FIRST**

Create branch: `feat/milestone-4` from current `main`.
Do NOT push directly to `main`. This is a governance rule.
Open a PR: `feat/milestone-4` → `main`. Base44 will review and merge.

---

## What Must NOT Be Done in Milestone 4

- No payment integration (Paystack, Stripe) — that is Milestone 6+
- No frontend apps (no React, no Next.js, no Vite) — `apps/api` is Worker-only
- No authentication-required routes for discovery endpoints (they are public)
- No claim state advancement — only claim *intent* capture (a lightweight interest record)
- No workspace activation — that is Milestone 5 (Claim-First Onboarding)
- No direct pushes to `main`
- No Express or Node.js HTTP servers

---

## Packages Already Implemented (DO NOT MODIFY without TDR)

```
packages/types/             ← @webwaka/types
packages/auth/              ← @webwaka/auth
packages/core/geography/    ← @webwaka/geography
packages/core/politics/     ← @webwaka/politics
packages/entities/          ← @webwaka/entities (Milestone 3)
packages/entitlements/      ← @webwaka/entitlements (Milestone 3)
packages/relationships/     ← @webwaka/relationships (Milestone 3)
packages/offline-sync/      ← @webwaka/offline-sync (Milestone 3 scaffold)
packages/ai-abstraction/    ← @webwaka/ai (Milestone 3 scaffold)
```

---

## Milestone 4 Deliverables

---

### Deliverable 1 — D1 Migrations

#### Migration 0008 — Search index tables

File: `infra/db/migrations/0008_init_search_index.sql`

```sql
-- Full-text search index for discoverable entities
-- Used by GET /discovery/search

CREATE TABLE IF NOT EXISTS search_entries (
  id            TEXT    NOT NULL PRIMARY KEY,
  entity_type   TEXT    NOT NULL,   -- 'individual' | 'organization' | 'place' | 'offering'
  entity_id     TEXT    NOT NULL,
  tenant_id     TEXT    NOT NULL,
  display_name  TEXT    NOT NULL,
  keywords      TEXT    NOT NULL,   -- space-separated normalised terms
  place_id      TEXT    REFERENCES places(id),
  ancestry_path TEXT    NOT NULL DEFAULT '[]',  -- JSON array of place IDs
  visibility    TEXT    NOT NULL DEFAULT 'public', -- 'public' | 'private' | 'unlisted'
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_search_entries_entity_type ON search_entries(entity_type);
CREATE INDEX IF NOT EXISTS idx_search_entries_place_id    ON search_entries(place_id);
CREATE INDEX IF NOT EXISTS idx_search_entries_tenant_id   ON search_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_search_entries_visibility  ON search_entries(visibility);

-- SQLite FTS5 virtual table for keyword search
CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  entity_id UNINDEXED,
  display_name,
  keywords,
  content='search_entries',
  content_rowid='rowid'
);
```

#### Migration 0009 — Discovery events log

File: `infra/db/migrations/0009_init_discovery_events.sql`

```sql
-- Discovery events: profile views, search hits, claim intents
-- Lightweight audit trail for discovery activity

CREATE TABLE IF NOT EXISTS discovery_events (
  id            TEXT    NOT NULL PRIMARY KEY,
  event_type    TEXT    NOT NULL,  -- 'profile_view' | 'search_hit' | 'claim_intent'
  entity_type   TEXT,
  entity_id     TEXT,
  place_id      TEXT    REFERENCES places(id),
  query         TEXT,              -- search query string (for search_hit events)
  actor_id      TEXT,             -- authenticated user ID if known (nullable)
  ip_hash       TEXT,             -- hashed IP for rate-limiting (never raw IP)
  metadata      TEXT    NOT NULL DEFAULT '{}',  -- JSON
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_discovery_events_entity_id  ON discovery_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_discovery_events_event_type ON discovery_events(event_type);
CREATE INDEX IF NOT EXISTS idx_discovery_events_place_id   ON discovery_events(place_id);
CREATE INDEX IF NOT EXISTS idx_discovery_events_created_at ON discovery_events(created_at);
```

---

### Deliverable 2 — `apps/api` — Discovery Routes

Add a new route file: `apps/api/src/routes/discovery.ts`

Mount in `apps/api/src/index.ts`:
```typescript
import { discoveryRoutes } from './routes/discovery.js';
// Public — no auth middleware
app.route('/discovery', discoveryRoutes);
```

#### Route 1 — `GET /discovery/search`

**Purpose:** Full-text + geography-filtered entity search. Public. No auth required.

**Query parameters:**
- `q` (required) — search query string, min 2 chars
- `type` (optional) — filter by entity type: `individual | organization | place | offering`
- `placeId` (optional) — restrict results to entities within this geography subtree (uses ancestry_path)
- `limit` (optional, default 20, max 100)
- `cursor` (optional) — pagination cursor

**Response:**
```typescript
{
  items: Array<{
    entityType: string;
    entityId: string;
    displayName: string;
    placeId: string | null;
    placeName: string | null;
  }>;
  nextCursor: string | null;
  total: number;
}
```

**Implementation notes:**
- Query the `search_fts` FTS5 table using SQLite FTS5 MATCH syntax
- If `placeId` provided: filter `search_entries.ancestry_path` using JSON_EACH or LIKE '%placeId%'
- Only return entries where `visibility = 'public'`
- Log a `search_hit` event to `discovery_events`
- Platform Invariant T3: no tenant-scoped filter needed here — discovery is cross-tenant

#### Route 2 — `GET /discovery/profiles/:subjectType/:subjectId`

**Purpose:** Public profile hydration for a single entity. No auth required.

**Path parameters:**
- `subjectType` — `individual | organization | place`
- `subjectId` — entity ID (e.g. `ind_abc123`)

**Response:**
```typescript
{
  profile: {
    id: string;
    subjectType: string;
    subjectId: string;
    claimState: string;       // 'seeded' | 'claimable' | 'claim_pending' | 'verified' | 'managed'
    primaryPlaceId: string | null;
  };
  subject: Individual | Organization | null;  // hydrated entity record
  place: {
    id: string;
    name: string;
    ancestryPath: string[];
  } | null;
  relationships: Relationship[];  // outbound relationships for this entity
}
```

**Implementation notes:**
- Fetch profile via `getProfileBySubject(db, subjectType, subjectId)` from `@webwaka/entities`
- Hydrate subject from individuals or organizations table based on `subjectType`
- Hydrate place using `getPlaceById` from `@webwaka/entities`
- Fetch relationships using `listRelationships(db, { subjectId, limit: 20 })` from `@webwaka/relationships`
- Return 404 if no profile found
- Log a `profile_view` event to `discovery_events`
- Do NOT expose `tenant_id` in the public response

#### Route 3 — `POST /discovery/claim-intent`

**Purpose:** Unauthenticated capture of claim interest. Does not change claim state. Creates a record of intent for later follow-up.

**Request body:**
```typescript
{
  subjectType: 'individual' | 'organization';
  subjectId: string;
  contactEmail: string;   // basic email validation only
  contactName?: string;
  message?: string;       // optional free-text, max 500 chars
}
```

**Response:**
```typescript
{ success: true; intentId: string; }
```

**Implementation notes:**
- Validate that a profile exists for the subjectId via `getProfileBySubject`
- Validate that profile `claimState` is `'seeded'` or `'claimable'` (reject if already `'claim_pending'`, `'verified'`, or `'managed'`)
- Insert a `claim_intent` row into `discovery_events` with `event_type: 'claim_intent'`
- `intentId` = a new `crypto.randomUUID()` prefixed with `ci_`
- Rate limit: reject if same `ip_hash` has submitted > 3 claim intents in last 24h (use `discovery_events` query)
- Return 409 if profile already claimed/verified/managed

#### Route 4 — `GET /discovery/nearby/:placeId`

**Purpose:** Return all discoverable entities within a geography subtree. Public.

**Path parameters:**
- `placeId` — place ID to use as subtree root

**Query parameters:**
- `type` (optional) — filter by entity type
- `limit` (optional, default 20, max 100)
- `cursor` (optional)

**Response:**
```typescript
{
  items: Array<{
    entityType: string;
    entityId: string;
    displayName: string;
    placeId: string;
    placeName: string;
  }>;
  nextCursor: string | null;
  placeId: string;
  placeName: string;
}
```

**Implementation notes:**
- Use `getAncestry` from `@webwaka/geography` to validate `placeId` exists
- Query `search_entries` WHERE `ancestry_path LIKE '%{placeId}%'`
- Only `visibility = 'public'`
- Return 404 if `placeId` not found in geography index

#### Route 5 — `GET /discovery/trending`

**Purpose:** Return most-viewed public profiles this week. Public.

**Query parameters:**
- `type` (optional) — filter by entity type
- `placeId` (optional) — restrict to geography subtree
- `limit` (optional, default 10, max 50)

**Response:**
```typescript
{
  items: Array<{
    entityType: string;
    entityId: string;
    displayName: string;
    viewCount: number;
    placeId: string | null;
  }>;
  weekStarting: string; // ISO date
}
```

**Implementation notes:**
- Query `discovery_events` WHERE `event_type = 'profile_view'` AND `created_at > (unixepoch() - 604800)`
- Group by `entity_id`, COUNT(*) as `viewCount`, ORDER BY `viewCount DESC`
- Join to `search_entries` for display metadata
- Apply `type` and `placeId` ancestry filters if provided

---

### Deliverable 3 — Search Index Population Helpers

Add `apps/api/src/lib/search-index.ts`:

```typescript
// Utilities for keeping search_entries in sync with entity writes

export async function indexIndividual(db: D1Database, individual: Individual, tenantId: TenantId): Promise<void>
export async function indexOrganization(db: D1Database, org: Organization, tenantId: TenantId): Promise<void>
export async function removeFromIndex(db: D1Database, entityId: string): Promise<void>
```

**Wire these into the existing entity create routes** (`apps/api/src/routes/entities.ts`):
- After `createIndividual(...)` → call `indexIndividual(...)`
- After `createOrganization(...)` → call `indexOrganization(...)`

This ensures new entities are immediately discoverable.

---

### Deliverable 4 — `packages/search-indexing` (Scaffold Only)

Directory: `packages/search-indexing/`

This is a **scaffold only** in M4. Type contracts for future full-text search adapter abstraction.

**What to implement:**

`src/types.ts`:
```typescript
export interface SearchEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  tenantId: TenantId;
  displayName: string;
  keywords: string;
  placeId: string | null;
  ancestryPath: string[];
  visibility: 'public' | 'private' | 'unlisted';
  createdAt: number;
  updatedAt: number;
}

export interface SearchQuery {
  q: string;
  type?: EntityType;
  placeId?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchResult {
  items: SearchResultItem[];
  nextCursor: string | null;
  total: number;
}

export interface SearchResultItem {
  entityType: EntityType;
  entityId: string;
  displayName: string;
  placeId: string | null;
  placeName: string | null;
  score?: number;
}

// Adapter interface — runtime implementations are Milestone 5+
export interface SearchAdapter {
  index(entry: Omit<SearchEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  remove(entityId: string): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult>;
}
```

`src/index.ts` — re-exports all types.

**Package.json:** Same shape as `@webwaka/offline-sync`.
**Tests:** `passWithNoTests` is acceptable for M4.

---

### Deliverable 5 — `wrangler.toml` Update

Add the new D1 migrations to the wrangler config so they run on deploy:

No code change needed — D1 migrations are applied via `wrangler d1 migrations apply`.

Add a note in `apps/api/wrangler.toml` that migrations 0008 and 0009 exist and must be applied before deployment:

```toml
# Pending migrations (apply before next deploy):
# wrangler d1 migrations apply webwaka-main --remote
# 0008_init_search_index.sql
# 0009_init_discovery_events.sql
```

---

### Deliverable 6 — Tests

**Required test file:** `apps/api/src/routes/discovery.test.ts`

Minimum 20 tests covering:

1. `GET /discovery/search` — returns results for a valid query
2. `GET /discovery/search` — returns 400 for query < 2 chars
3. `GET /discovery/search?type=individual` — type filter works
4. `GET /discovery/search?placeId=plc_abc` — geography filter works
5. `GET /discovery/search` — only returns visibility=public entries
6. `GET /discovery/profiles/individual/:id` — returns hydrated profile
7. `GET /discovery/profiles/individual/:id` — returns 404 for unknown entity
8. `GET /discovery/profiles/individual/:id` — does not expose tenant_id
9. `POST /discovery/claim-intent` — succeeds for seeded profile
10. `POST /discovery/claim-intent` — returns 409 for already-managed profile
11. `POST /discovery/claim-intent` — returns 400 for invalid email
12. `POST /discovery/claim-intent` — returns 409 for already-pending claim
13. `GET /discovery/nearby/:placeId` — returns entities in subtree
14. `GET /discovery/nearby/:placeId` — returns 404 for unknown placeId
15. `GET /discovery/nearby/:placeId?type=organization` — type filter works
16. `GET /discovery/trending` — returns top profiles by view count
17. `GET /discovery/trending?type=individual` — type filter works
18. `GET /discovery/trending?placeId=plc_abc` — geography filter works
19. Search index wired: creating an individual via POST /entities/individuals also indexes it
20. Discovery events logged: GET /discovery/profiles/:type/:id logs a profile_view event

Use vitest `vi.fn()` to mock D1Database. Follow the same patterns established in `apps/api/src/api.test.ts`.

---

### Deliverable 7 — Governance: Update `replit.md`

Add a Milestone 4 section to `replit.md` documenting:
- New routes added
- New migrations added
- New packages added

---

## CI Requirements

All existing CI jobs must continue to pass after your changes.

The CI runs `pnpm -r run test` and `pnpm -r run typecheck` across all packages.

For `packages/search-indexing`:
1. Add a `package.json` with `test` and `typecheck` scripts
2. Add a `tsconfig.json` extending `../../../tsconfig.base.json`
3. Add a `vitest.config.ts` with `resolve.alias` for `@webwaka/*` dependencies
4. Ensure `pnpm-workspace.yaml` covers the new package (it already covers `packages/*`)

**Minimum required test count after M4: 171+ tests (151 existing + 20 new discovery tests)**

---

## PR Instructions

**Branch:** `feat/milestone-4`
**Base:** `main`
**Title:** `feat(milestone-4): discovery layer MVP — search, profiles, claim intent`
**Description must include:**
- Summary of all 7 deliverables
- List of new routes added (5 routes)
- New migrations: 0008, 0009
- CI status (link to passing run)
- Any deferred items with justification

**Tags:** `milestone-4`, `review-needed`, `base44`

---

## Summary Checklist

```
[ ] Branch: feat/milestone-4 from main
[ ] Migration 0008 — search_entries + search_fts (FTS5)
[ ] Migration 0009 — discovery_events
[ ] apps/api — GET /discovery/search
[ ] apps/api — GET /discovery/profiles/:subjectType/:subjectId
[ ] apps/api — POST /discovery/claim-intent
[ ] apps/api — GET /discovery/nearby/:placeId
[ ] apps/api — GET /discovery/trending
[ ] apps/api/src/lib/search-index.ts — index helpers wired into entity create routes
[ ] packages/search-indexing — scaffold types (passWithNoTests)
[ ] wrangler.toml — migration note added
[ ] apps/api/src/routes/discovery.test.ts — ≥ 20 tests
[ ] All 171+ tests passing
[ ] All packages typecheck clean
[ ] replit.md updated
[ ] PR opened: feat/milestone-4 → main
```

---

*Brief prepared by Base44 Super Agent (OpenClaw) — WebWaka OS governance and QA layer*
*2026-04-07 20:31 WAT*
