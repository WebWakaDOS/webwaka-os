# WebWaka OS — Milestone 3 Replit Brief

**Prepared by:** Base44 Super Agent (OpenClaw)
**Date:** 2026-04-07, 16:52 WAT
**Milestone:** 3 — Vertical Package Scaffolding + First API Wiring
**Status:** ACTIVE — Founder approved Milestone 2 at 16:52 WAT today

---

## Context

Milestone 2 delivered the shared core foundation:
- `@webwaka/types` — all 7 root entity types, enums, IDs, auth, subscription types
- `@webwaka/geography` — hierarchy, rollup, ancestry helpers
- `@webwaka/politics` — office/territory model, assignment, term records
- `@webwaka/auth` — JWT validation (Web Crypto), role guards, entitlement context
- D1 migrations 0001–0006 — places, individuals, organizations, workspaces, memberships, subscriptions, profiles, political tables
- CI: Audit ✅ TypeCheck ✅ Tests ✅ Lint ✅

Milestone 3 scaffolds the next layer of shared packages and wires the first Hono API. **No vertical-specific features.** Foundation only.

---

## Repo State You Are Starting From

**Branch:** `main`
**HEAD:** `37198e83f084b48a2e4da5b1509866204e161786`
**Staging HEAD:** `6a9f1c1f9da596552746f78bb568a6a314dba020`

These directories exist as `.gitkeep` placeholders, ready to be implemented:
```
packages/entities/          ← Milestone 3 primary target
packages/entitlements/      ← Milestone 3 primary target
packages/offline-sync/      ← Milestone 3 secondary target
packages/ai-abstraction/    ← Milestone 3 secondary target
packages/relationships/     ← Milestone 3 secondary target
packages/workspaces/        ← Milestone 3 secondary target
packages/profiles/          ← Milestone 3 secondary target
apps/api/                   ← Milestone 3 first app wiring
```

These are **already implemented** (do not re-implement or duplicate):
```
packages/types/             ← @webwaka/types — DO NOT MODIFY without TDR
packages/auth/              ← @webwaka/auth — DO NOT MODIFY without TDR
packages/core/geography/    ← @webwaka/geography — DO NOT MODIFY without TDR
packages/core/politics/     ← @webwaka/politics — DO NOT MODIFY without TDR
```

---

## Carried Over From Milestone 2 (Required in Milestone 3)

| Issue | What is needed |
|---|---|
| #8 | Full LGA seed (774) + Ward seed (8,814) — large SQL seed files |
| #11 | `buildIndexFromD1(db: D1Database)` helper in `@webwaka/geography` |
| #12 | `CandidateRecord.id` field + `UNIQUE(individual_id, jurisdiction_id, office_type)` constraint on `political_assignments` |

---

## Milestone 3 Deliverables

### BRANCH DISCIPLINE — READ FIRST

**Create branch: `feat/milestone-3` from current `main`.**

Do NOT push directly to `main` again. This is a repeat governance violation from Milestone 2.
Open a PR: `feat/milestone-3` → `main`. Base44 will review and merge.

---

### Deliverable 1 — `packages/entities` — `@webwaka/entities`

**Purpose:** CRUD layer for all 7 root entities against D1. Query helpers, ID generation, conflict guards.

**What to implement:**

1. **`src/ids.ts`** — ID generation for each entity type using branded IDs from `@webwaka/types`:
   ```typescript
   import { asId, IndividualId, OrganizationId, PlaceId } from '@webwaka/types';
   export function generateIndividualId(): IndividualId
   export function generateOrganizationId(): OrganizationId
   export function generatePlaceId(): PlaceId
   // ... for all 7 entity types
   ```
   Use `crypto.randomUUID()` (Web Crypto) + type prefix:
   - `ind_` for Individual
   - `org_` for Organization
   - `plc_` for Place
   - `off_` for Offering
   - `prf_` for Profile
   - `wsp_` for Workspace
   - `brs_` for BrandSurface

2. **`src/repository/individuals.ts`** — D1 CRUD for individuals table:
   - `createIndividual(db: D1Database, tenantId: TenantId, input: CreateIndividualInput): Promise<Individual>`
   - `getIndividualById(db: D1Database, tenantId: TenantId, id: IndividualId): Promise<Individual | null>`
   - `listIndividualsByTenant(db: D1Database, tenantId: TenantId, opts?: PaginationOptions): Promise<PaginatedResult<Individual>>`
   - `updateIndividual(db: D1Database, tenantId: TenantId, id: IndividualId, patch: Partial<CreateIndividualInput>): Promise<Individual | null>`

   Platform Invariant T3: **Every query must include a `tenant_id` predicate.** No exceptions.

3. **`src/repository/organizations.ts`** — same shape as individuals.

4. **`src/repository/workspaces.ts`** — CRUD for workspaces + memberships:
   - `createWorkspace(...)` — creates workspace + auto-creates membership for owner as `admin`
   - `getWorkspaceById(...)` — fetches workspace + active subscription status
   - `addMember(...)` — adds a user to a workspace with a role
   - `removeMember(...)` — removes membership

5. **`src/repository/places.ts`** — geography-aware CRUD:
   - `createPlace(db, tenantId, input)` — validates parent exists, computes `ancestryPath`
   - `getPlaceById(db, placeId)` — no tenant filter (shared geography nodes)
   - `listPlacesByParent(db, parentId)` — direct children only
   - Uses `@webwaka/geography` for ancestry path building

6. **`src/repository/profiles.ts`** — claim-first CRUD:
   - `seedProfile(db, subjectType, subjectId, primaryPlaceId)` — creates `claim_state: 'seeded'`
   - `advanceClaimState(db, profileId, nextState, verifiedBy?)` — validates transitions
   - `getProfileBySubject(db, subjectType, subjectId)` — lookup for discovery

7. **`src/pagination.ts`** — shared pagination primitives:
   ```typescript
   export interface PaginationOptions { limit: number; cursor?: string; }
   export interface PaginatedResult<T> { items: T[]; nextCursor: string | null; total?: number; }
   ```

8. **`src/index.ts`** — re-exports all of the above

**D1 type binding:**
```typescript
// Use D1Database type from @cloudflare/workers-types
// Import: import type { D1Database } from '@cloudflare/workers-types';
// devDependencies: "@cloudflare/workers-types": "^4.20240620.0"
```

**Package.json:**
```json
{
  "name": "@webwaka/entities",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@webwaka/types": "workspace:*",
    "@webwaka/geography": "workspace:*"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240620.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

**Tests required:**
- `src/ids.test.ts` — ID format, uniqueness, branding
- `src/repository/individuals.test.ts` — CRUD with in-memory D1 mock
- `src/repository/profiles.test.ts` — claim state transitions (valid + invalid)

**D1 mocking for tests:** Use vitest `vi.fn()` to mock `D1Database`. Do not require an actual D1 binding for unit tests.

---

### Deliverable 2 — `packages/entitlements` — `@webwaka/entitlements`

**Purpose:** Subscription and platform layer management. Runtime evaluation of entitlement dimensions.

**What to implement:**

1. **`src/evaluate.ts`** — entitlement evaluation engine:
   ```typescript
   export interface EntitlementDecision {
     allowed: boolean;
     reason?: string;
   }
   
   // Check if a workspace is entitled to a platform layer
   export function evaluateLayerAccess(
     subscription: Subscription,
     layer: PlatformLayer,
   ): EntitlementDecision
   
   // Check workspace is within user limit
   export function evaluateUserLimit(
     subscription: Subscription,
     currentMemberCount: number,
   ): EntitlementDecision
   
   // Check workspace is within branch/place limit
   export function evaluatePlaceLimit(
     subscription: Subscription,
     currentPlaceCount: number,
   ): EntitlementDecision
   ```

2. **`src/plan-config.ts`** — plan capability matrix:
   ```typescript
   export interface PlanConfig {
     maxUsers: number;        // -1 = unlimited
     maxPlaces: number;       // -1 = unlimited
     maxOfferings: number;    // -1 = unlimited
     layers: PlatformLayer[];
     brandingRights: boolean;
     whiteLabelDepth: 0 | 1 | 2;  // 0=none, 1=partner, 2=sub-partner
     delegationRights: boolean;
     aiRights: boolean;
     sensitiveSectorRights: boolean;
   }
   
   export const PLAN_CONFIGS: Readonly<Record<SubscriptionPlan, PlanConfig>>
   ```
   Define configs for: `free`, `starter`, `growth`, `professional`, `enterprise`.
   Free: maxUsers=3, maxPlaces=1, maxOfferings=5, layers=['discovery'], no branding.
   Enterprise: unlimited everything, all layers, white-label depth 2.

3. **`src/guards.ts`** — guard functions that throw `EntitlementError`:
   ```typescript
   export function requireLayerAccess(ctx: EntitlementContext, layer: PlatformLayer): void
   export function requireBrandingRights(ctx: EntitlementContext): void
   export function requireDelegationRights(ctx: EntitlementContext): void
   export function requireAIAccess(ctx: EntitlementContext): void
   ```

4. **`src/index.ts`** — re-exports everything

**Tests required:**
- `src/evaluate.test.ts` — all plan configs evaluated for access and limits
- `src/guards.test.ts` — throws on denied, passes on allowed

---

### Deliverable 3 — `packages/relationships` — `@webwaka/relationships`

**Purpose:** Typed relationship primitives from `relationship-schema.md`.

**What to implement:**

1. **`src/types.ts`** — relationship type constants and interfaces:
   ```typescript
   export const RelationshipKind = {
     Owns: 'owns',
     Manages: 'manages',
     Claims: 'claims',
     AffiliatedWith: 'affiliated_with',
     BelongsTo: 'belongs_to',
     DelegatesTo: 'delegates_to',
     Offers: 'offers',
     PublishesTo: 'publishes_to',
     ListedIn: 'listed_in',
     LocatedIn: 'located_in',
     OperatesIn: 'operates_in',
     Serves: 'serves',
     Hosts: 'hosts',
     HoldsOffice: 'holds_office',
     JurisdictionOver: 'jurisdiction_over',
   } as const;
   
   export interface Relationship {
     id: string;
     kind: RelationshipKind;
     subjectType: EntityType;
     subjectId: string;
     objectType: EntityType;
     objectId: string;
     tenantId: TenantId;
     metadata?: Record<string, unknown>;
     createdAt: string;
   }
   ```

2. **D1 migration** — `infra/db/migrations/0007_init_relationships.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS relationships (
     id           TEXT NOT NULL PRIMARY KEY,
     kind         TEXT NOT NULL,
     subject_type TEXT NOT NULL,
     subject_id   TEXT NOT NULL,
     object_type  TEXT NOT NULL,
     object_id    TEXT NOT NULL,
     tenant_id    TEXT NOT NULL,
     metadata     TEXT, -- JSON
     created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
     updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
   );
   CREATE INDEX IF NOT EXISTS idx_relationships_subject ON relationships(subject_type, subject_id);
   CREATE INDEX IF NOT EXISTS idx_relationships_object ON relationships(object_type, object_id);
   CREATE INDEX IF NOT EXISTS idx_relationships_kind ON relationships(kind);
   CREATE INDEX IF NOT EXISTS idx_relationships_tenant_id ON relationships(tenant_id);
   ```

3. **`src/repository.ts`** — D1 CRUD:
   - `createRelationship(db, tenantId, input)` — validates both sides exist conceptually
   - `listRelationships(db, tenantId, filter: { subjectId?, objectId?, kind? })` — flexible query
   - `deleteRelationship(db, tenantId, id)` — tenant-scoped delete

4. **Tests:** `src/relationships.test.ts` — create, list, filter by kind

---

### Deliverable 4 — `apps/api` — First Hono API Wiring

**Purpose:** The first real Cloudflare Worker HTTP app. Routes auth, geography lookups, entity create/get. No verticals yet.

**What to implement:**

1. **`wrangler.toml`**:
   ```toml
   name = "webwaka-api"
   main = "src/index.ts"
   compatibility_date = "2024-06-20"
   compatibility_flags = ["nodejs_compat"]
   
   [[d1_databases]]
   binding = "DB"
   database_name = "webwaka-os-staging"
   database_id = "placeholder-replace-in-ci"
   migrations_dir = "../../infra/db/migrations"
   ```

2. **`src/index.ts`** — Hono app entry:
   ```typescript
   import { Hono } from 'hono';
   import { authRouter } from './routes/auth.js';
   import { geographyRouter } from './routes/geography.js';
   import { entitiesRouter } from './routes/entities.js';
   
   const app = new Hono<{ Bindings: CloudflareBindings }>();
   
   app.route('/auth', authRouter);
   app.route('/geography', geographyRouter);
   app.route('/entities', entitiesRouter);
   
   app.get('/health', (c) => c.json({ status: 'ok', milestone: 3 }));
   
   export default app;
   ```

3. **`src/bindings.ts`** — Cloudflare Worker bindings type:
   ```typescript
   export interface CloudflareBindings {
     DB: D1Database;
     JWT_SECRET: string;
     INTER_SERVICE_SECRET: string;
   }
   ```

4. **`src/middleware/auth.ts`** — wire `@webwaka/auth`'s `resolveAuthContext` into Hono:
   ```typescript
   export const jwtAuthMiddleware = createMiddleware<{ Bindings: CloudflareBindings }>(
     async (c, next) => {
       const result = await resolveAuthContext(
         c.req.header('Authorization') ?? null,
         c.env.JWT_SECRET
       );
       if (!result.success) {
         return c.json({ error: result.message }, result.status);
       }
       c.set('authContext', result.context);
       await next();
     }
   );
   ```

5. **`src/routes/auth.ts`** — 2 endpoints:
   - `GET /auth/me` — protected by `jwtAuthMiddleware`, returns `AuthContext`
   - `POST /auth/verify` — validate a JWT and return decoded payload (no secret in response)

6. **`src/routes/geography.ts`** — 3 endpoints (public, no auth):
   - `GET /geography/places/:id` — get a place by ID
   - `GET /geography/places/:id/children` — direct children of a place
   - `GET /geography/places/:id/ancestry` — full ancestry path (breadcrumb)

7. **`src/routes/entities.ts`** — protected by `jwtAuthMiddleware`:
   - `POST /entities/individuals` — create an individual (tenant-scoped)
   - `GET /entities/individuals/:id` — get by ID (tenant-scoped)
   - `POST /entities/organizations` — create an org
   - `GET /entities/organizations/:id` — get by ID

8. **`package.json`**:
   ```json
   {
     "name": "@webwaka/api",
     "version": "0.1.0",
     "private": true,
     "dependencies": {
       "@webwaka/auth": "workspace:*",
       "@webwaka/types": "workspace:*",
       "@webwaka/entities": "workspace:*",
       "@webwaka/geography": "workspace:*",
       "hono": "^4.4.0"
     },
     "devDependencies": {
       "@cloudflare/workers-types": "^4.20240620.0",
       "@cloudflare/vitest-pool-workers": "^0.5.0",
       "wrangler": "^3.60.0",
       "typescript": "^5.4.5",
       "vitest": "^1.6.0"
     }
   }
   ```

9. **Tests:** `src/routes/auth.test.ts` — test `/health`, `GET /auth/me` with valid + invalid JWT.
   Use `@cloudflare/vitest-pool-workers` for Worker-accurate tests.

---

### Deliverable 5 — `packages/offline-sync` — `@webwaka/offline-sync` (Scaffold Only)

**Purpose:** Type contracts and interfaces for the PWA offline sync layer. No full implementation yet — types and interface contracts only.

Platform Invariant P6 requires: writes queue offline, sync on reconnect, deterministic conflict resolution.

**What to implement (interfaces only — no runtime implementation in M3):**

1. **`src/types.ts`**:
   ```typescript
   export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
   
   export interface SyncQueueItem {
     id: string;
     entityType: EntityType;
     entityId: string;
     operation: 'create' | 'update' | 'delete';
     payload: unknown;
     attemptCount: number;
     status: SyncStatus;
     createdAt: number; // Unix timestamp
     lastAttemptAt: number | null;
     error: string | null;
   }
   
   export interface ConflictResolution {
     strategy: 'client-wins' | 'server-wins' | 'last-write-wins' | 'manual';
     resolvedAt: number;
     resolvedBy?: string;
   }
   
   export interface SyncAdapter {
     enqueue(item: Omit<SyncQueueItem, 'id' | 'attemptCount' | 'status' | 'createdAt' | 'lastAttemptAt' | 'error'>): Promise<string>;
     dequeue(status: SyncStatus): Promise<SyncQueueItem[]>;
     updateStatus(id: string, status: SyncStatus, error?: string): Promise<void>;
     resolveConflict(id: string, resolution: ConflictResolution): Promise<void>;
   }
   ```

2. **`src/index.ts`** — re-exports types
3. **Tests:** `src/types.test.ts` — TypeScript type correctness via `satisfies` checks; `passWithNoTests`

---

### Deliverable 6 — `packages/ai-abstraction` — `@webwaka/ai` (Scaffold Only)

**Purpose:** Provider abstraction type contracts. Platform Invariant P7 (no direct SDK calls to OpenAI/Anthropic) and P8 (BYOK).

**What to implement (interfaces only — no runtime calls in M3):**

1. **`src/types.ts`**:
   ```typescript
   export type AIProvider = 'openai' | 'anthropic' | 'google' | 'byok';
   
   export interface AIProviderConfig {
     provider: AIProvider;
     model: string;
     apiKey: string; // From tenant BYOK or platform secret — never hardcoded
     baseUrl?: string; // For BYOK custom endpoints
   }
   
   export interface AIMessage {
     role: 'system' | 'user' | 'assistant';
     content: string;
   }
   
   export interface AIRequest {
     messages: AIMessage[];
     maxTokens?: number;
     temperature?: number;
     stream?: boolean;
   }
   
   export interface AIResponse {
     content: string;
     provider: AIProvider;
     model: string;
     tokensUsed: number;
     finishReason: 'stop' | 'length' | 'error';
   }
   
   // The contract every AI adapter must implement
   export interface AIAdapter {
     complete(request: AIRequest): Promise<AIResponse>;
     stream?(request: AIRequest): AsyncIterable<string>;
   }
   ```

2. **`src/index.ts`** — re-exports
3. **Tests:** `passWithNoTests` is acceptable for M3

---

### Deliverable 7 — Carry-Over Issues from Milestone 2

#### Issue #11 — `buildIndexFromD1` in `@webwaka/geography`

Add to `packages/core/geography/src/`:

```typescript
// src/d1.ts
export async function buildIndexFromD1(db: D1Database): Promise<GeographyIndex> {
  const { results } = await db.prepare(
    'SELECT id, name, geography_type, level, parent_id, ancestry_path FROM places ORDER BY level ASC'
  ).all<{
    id: string;
    name: string;
    geography_type: string;
    level: number;
    parent_id: string | null;
    ancestry_path: string;
  }>();
  
  const nodes: GeographyNode[] = results.map(row => ({
    id: asId<PlaceId>(row.id),
    name: row.name,
    level: row.level as GeographyLevel,
    geographyType: row.geography_type as GeographyType,
    parentId: row.parent_id ? asId<PlaceId>(row.parent_id) : null,
    ancestryPath: JSON.parse(row.ancestry_path) as PlaceId[],
  }));
  
  return buildIndex(nodes);
}
```

Export from `packages/core/geography/src/index.ts`.

#### Issue #12 — Political assignment constraint + CandidateRecord.id

1. Add migration `infra/db/migrations/0007a_political_assignments_constraint.sql`:
   ```sql
   -- Note: SQLite does not support ADD CONSTRAINT on existing tables.
   -- This migration recreates the table with the unique constraint.
   CREATE TABLE IF NOT EXISTS political_assignments_new (
     id                 TEXT NOT NULL PRIMARY KEY,
     individual_id      TEXT NOT NULL REFERENCES individuals(id),
     office_type        TEXT NOT NULL,
     jurisdiction_id    TEXT NOT NULL REFERENCES jurisdictions(id),
     term_id            TEXT NOT NULL REFERENCES terms(id),
     verification_state TEXT NOT NULL DEFAULT 'unverified',
     tenant_id          TEXT NOT NULL,
     created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
     updated_at         INTEGER NOT NULL DEFAULT (unixepoch()),
     UNIQUE (individual_id, jurisdiction_id, office_type)
   );
   INSERT OR IGNORE INTO political_assignments_new SELECT * FROM political_assignments;
   DROP TABLE political_assignments;
   ALTER TABLE political_assignments_new RENAME TO political_assignments;
   CREATE INDEX IF NOT EXISTS idx_political_assignments_individual_id ON political_assignments(individual_id);
   CREATE INDEX IF NOT EXISTS idx_political_assignments_jurisdiction_id ON political_assignments(jurisdiction_id);
   CREATE INDEX IF NOT EXISTS idx_political_assignments_office_type ON political_assignments(office_type);
   CREATE INDEX IF NOT EXISTS idx_political_assignments_tenant_id ON political_assignments(tenant_id);
   ```

2. Add `id: string` to `CandidateRecord` in `packages/core/politics/src/types.ts`

#### Issue #8 — LGA and Ward Seed Data

Add two seed files:
- `infra/db/seeds/0002_lgas.sql` — all 774 Nigerian LGAs with correct ancestry paths to their states
- `infra/db/seeds/0003_wards.sql` — all 8,814 Nigerian wards (may be large — split into batches of 1,000 rows per INSERT)

Use `INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path)` format.

LGA IDs: `plc_lga_{state_abbr}_{lga_slug}` e.g. `plc_lga_la_ikeja`
Ward IDs: `plc_ward_{state_abbr}_{lga_slug}_{ward_slug}`

Ancestry paths must reference the correct state/zone/country IDs from seed 0001.

---

## What Must NOT Be Done in Milestone 3

- No vertical-specific packages (`packages/market-discovery`, `packages/ride-hailing`, etc.)
- No payment integration (Paystack, Stripe) — that is Milestone 4+
- No frontend apps (no React, no Vite apps) — `apps/api` is Worker-only
- No `packages/design-system` implementation — placeholder only
- No direct API calls to OpenAI or any AI provider — type contracts only
- No direct pushes to `main`
- No Express or Node.js HTTP servers in any app

---

## CI Requirements

All existing CI jobs must continue to pass after your changes.

The CI runs `pnpm -r run test` and `pnpm -r run typecheck` across all packages.

For new packages:
1. Add a `package.json` with `test` and `typecheck` scripts
2. Add a `tsconfig.json` extending `../../tsconfig.base.json` (or `../../../` for nested)
3. Add a `vitest.config.ts` with `resolve.alias` for `@webwaka/*` dependencies
4. Add an `.eslintrc.json` extending `../../.eslintrc.base.json`
5. Ensure `pnpm-workspace.yaml` covers your new package path (it already covers `packages/*`)

**For `apps/api` specifically:**
- Use `@cloudflare/vitest-pool-workers` for tests
- The `vitest.config.ts` in `apps/api` needs `pool: 'workers'` configuration
- Wrangler config for tests: minimal `wrangler.toml` with a test D1 binding

---

## PR Instructions

**Branch:** `feat/milestone-3`
**Base:** `main`
**Title:** `feat(milestone-3): vertical package scaffolding + first API wiring`
**Description must include:**
- Summary of all 7 deliverables
- List of issues resolved: #8, #11, #12
- CI status (link to passing run)
- Any deferred items with justification

Tag in PR: `milestone-3`, `review-needed`, `base44`

---

## Summary Checklist

```
[ ] Branch: feat/milestone-3 from main
[ ] @webwaka/entities — CRUD for all 7 root entities against D1
[ ] @webwaka/entitlements — plan config matrix + evaluation engine + guards
[ ] @webwaka/relationships — typed relationships + D1 migration 0007
[ ] apps/api — Hono Worker with /health, /auth, /geography, /entities routes
[ ] @webwaka/offline-sync — type contracts + SyncAdapter interface (scaffold only)
[ ] @webwaka/ai — provider abstraction types (scaffold only)
[ ] Issue #11 — buildIndexFromD1 in @webwaka/geography
[ ] Issue #12 — political_assignments UNIQUE constraint + CandidateRecord.id
[ ] Issue #8 — LGA (774) + Ward (8,814) seed files
[ ] All packages have: package.json, tsconfig.json, vitest.config.ts, .eslintrc.json
[ ] CI fully green (all 4 jobs)
[ ] PR opened: feat/milestone-3 → main
```

---

*Brief prepared by Base44 Super Agent (OpenClaw) — WebWaka OS governance and QA layer*
*2026-04-07 16:52 WAT*
