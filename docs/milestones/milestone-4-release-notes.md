# Milestone 4 — Discovery Layer MVP: Release Notes

**Date:** 2026-04-07  
**Branch:** `feat/milestone-4` → `main`  
**CI:** 171 tests passing · 12 packages typecheck clean

## Deliverables

### D1 Migrations
- `0008_init_search_index.sql` — `search_entries` table + `search_fts` FTS5 virtual table (full-text search)
- `0009_init_discovery_events.sql` — `discovery_events` audit log (profile views, search hits, claim intents)

### 5 New Discovery Routes (`apps/api/src/routes/discovery.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/discovery/search` | none | Full-text + geography-filtered entity search |
| GET | `/discovery/profiles/:subjectType/:subjectId` | none | Hydrated public profile |
| POST | `/discovery/claim-intent` | none | Unauthenticated claim interest capture |
| GET | `/discovery/nearby/:placeId` | none | Entities in a geography subtree |
| GET | `/discovery/trending` | none | Most-viewed profiles this week |

All routes are **public**. `tenant_id` is never exposed in public responses (T3/T6).

### Search Index Helpers (`apps/api/src/lib/search-index.ts`)
- `indexIndividual` / `indexOrganization` — upsert into `search_entries` (FTS5-backed)
- `removeFromIndex` — delete from `search_entries`
- Wired into entity create routes; indexing failures are non-fatal (logged, not thrown)

### `packages/search-indexing` Scaffold
- `SearchEntry`, `SearchQuery`, `SearchResult`, `SearchAdapter` interfaces
- Runtime implementation deferred to Milestone 5

### Test Coverage
- 20 new discovery tests in `apps/api/src/routes/discovery.test.ts`
- Total workspace: **171 tests**, all passing

## Platform Invariants Satisfied

| Invariant | How |
|-----------|-----|
| T2 — TypeScript strict | ✅ zero errors across 12 packages |
| T3 — `tenant_id` on scoped queries | ✅ discovery is cross-tenant (public only) |
| T6 — Geography-driven discovery | ✅ all search/nearby routes use place hierarchy |
| Discovery — no `tenant_id` in responses | ✅ explicitly omitted |

## Out of Scope (Milestone 5+)
- Claim state advancement (only intent capture in M4)
- Frontend discovery UI
- Payment integration
- Workspace activation
