# M7b QA Report — Offline Sync + USSD Gateway + POS Float Ledger

**Date:** 2026-04-08
**Reviewer:** QA Agent
**Branch:** `feat/m7b-offline-ussd-pos`
**PR:** [#24](https://github.com/WebWakaDOS/webwaka-os/pull/24)
**Verdict:** APPROVED WITH FIXES

---

## Test Results

| Package | Expected | Actual | Status |
|---|---|---|---|
| `@webwaka/offline-sync` | ≥29 | 29 | ✅ PASS |
| `@webwaka/ussd-gateway` | ≥41 | 41 | ✅ PASS |
| `@webwaka/pos` | ≥17 | 17 | ✅ PASS |
| `@webwaka/api` | ≥91 | 91 | ✅ PASS |
| **Total** | **≥178** | **178** | **✅ ALL PASS** |

---

## Typecheck

All four M7b packages typecheck with **0 errors** after applying fixes:

```
packages/offline-sync typecheck — Done ✅
apps/ussd-gateway typecheck     — Done ✅
packages/pos typecheck          — Done ✅
apps/api typecheck              — Done ✅
```

---

## Invariant Audit

| Invariant | Files Checked | Result | Notes |
|---|---|---|---|
| P6 — Offline queue never drops | `packages/offline-sync/src/adapter.ts`, `sync-engine.ts` | ✅ PASS | FIFO enforced via `sortBy('createdAt')`. Exponential backoff (30s→1h) via `computeNextRetry()`. Failed items re-queued, never silently discarded. |
| P9+T4 — Integer kobo only | `packages/pos/src/float-ledger.ts`, `apps/api/src/routes/pos.ts`, `apps/ussd-gateway/src/menus.ts` | ✅ PASS | `assertIntegerKobo()` guards every ledger entry. Zod `z.number().int().positive()` enforces at API layer. `Math.floor(balanceKobo / 100)` used in USSD display — no `toFixed` or `parseFloat` on monetary values. |
| P11 — Server-wins FIFO; idempotent replay | `packages/offline-sync/src/sync-engine.ts`, `apps/api/src/routes/sync.ts`, `infra/db/migrations/0025_agent_sessions_sync.sql` | ✅ PASS (after fix) | `client_id UNIQUE` constraint added to migration (Fix #2). Sync engine sorts pending+failed by `createdAt` for FIFO. Route returns `{ idempotent: true }` on duplicate `clientId`. |
| T3 — Tenant isolation on all queries | `apps/api/src/routes/pos.ts`, `apps/api/src/routes/sync.ts` | ✅ PASS | Every D1 query in both routes binds `auth.tenantId`. Float history verifies wallet belongs to tenant before returning. T3 advisory logged for USSD session KV (see Advisory section). |

---

## Checklist Results

### 1. DB Migrations

| Check | File | Result | Notes |
|---|---|---|---|
| 0022 — agents table, tenant_id, PK, FKs | `0022_agents.sql` | ✅ PASS | `tenant_id TEXT NOT NULL`, `id` PK, `individual_id REFERENCES individuals(id)` |
| 0023 — pos_terminals, agent_id FK, status CHECK | `0023_pos_terminals.sql` | ✅ PASS | `agent_id REFERENCES agents(id)`, `tenant_id NOT NULL`, `CHECK (status IN ('active', 'suspended', 'decommissioned'))` |
| 0024 — amount_kobo + running_balance_kobo INTEGER, append-only | `0024_float_ledger.sql` | ✅ PASS | Both columns `INTEGER NOT NULL`. No UPDATE/DELETE triggers. Comment explicitly states append-only. |
| 0025 — client_id UNIQUE, status DEFAULT 'pending', valid values | `0025_agent_sessions_sync.sql` | ✅ PASS (after fix) | **Fixed**: Added `UNIQUE` to `client_id`; changed DEFAULT to `'pending'`; corrected CHECK to `('pending', 'applied', 'conflict')`. |

### 2. packages/offline-sync

| Check | Result | Notes |
|---|---|---|
| `dequeue()` FIFO (oldest first) | ✅ PASS | `sortBy('createdAt')` — Dexie sorts ascending by createdAt. Confirmed by adapter tests. |
| Failed items re-queued, not dropped (P6) | ✅ PASS | `updateStatus('failed')` increments `retryCount` and sets `nextRetryAt` via `computeNextRetry()`. |
| No item silently lost on Dexie throw | ✅ PASS | `try/catch` in `SyncEngine.processPendingQueue()` catches all throws and calls `updateStatus('failed')`. |
| On conflict, server-wins (P11) | ✅ PASS | `resolveConflict()` with `strategy: 'server-wins'` marks item `synced`. |
| Retry uses exponential backoff | ✅ PASS | `computeNextRetry()` in adapter: 30s → 2m → 10m → 30m → 1h. |
| `utils.ts` has no monetary arithmetic | ✅ PASS | Contains only `generateId()` which wraps `crypto.randomUUID()`. |
| `db.ts` — explicit schema version | ✅ PASS | `this.version(1).stores(...)` explicit. Upgrade path: bump version + `.upgrade()` handler. |
| `service-worker.ts` — `'serviceWorker' in navigator` guard | ✅ PASS | Guard present at top of `registerSyncServiceWorker()`. |

### 3. apps/ussd-gateway

| Check | Result | Notes |
|---|---|---|
| KV TTL exactly 180 seconds | ✅ PASS | `SESSION_TTL = 180` constant; used in both `getOrCreateSession()` and `saveSession()`. |
| Session cleared after END (not left to TTL) | ✅ PASS | `deleteSession()` function implemented; `index.ts` calls it on `result.ended === true`. |
| Naira display uses integer math only (P9) | ✅ PASS | `Math.floor(balanceKobo / 100)` + modulo `% 100`. No `toFixed`, no `parseFloat`. |
| All CON branches non-empty; END branches correct | ✅ PASS | Every menu function verified. All `CON` prefixes have non-empty prompts. |
| Unknown FSM state → END, not exception | ✅ PASS | `default:` case in `processUSSDInput()` returns `endSession(...)`. |
| `index.ts` parses AT body fields correctly | ✅ PASS | `sessionId`, `phoneNumber`, `text` parsed via `c.req.parseBody()`. |
| Response `Content-Type` is `text/plain` | ✅ PASS | `c.text(result.text, 200, { 'Content-Type': 'text/plain' })` |
| Session key includes tenantId (T3) | ⚠️ ADVISORY | Key is `ussd:{sessionId}`. Africa's Talking sessionIds are globally unique per dial session, so no cross-tenant contamination at the KV session layer. Tenant routing is deferred to API calls which use JWT auth. Adding tenantId requires architectural input on phone → tenant resolution. Filed as advisory below. |

### 4. packages/pos

| Check | Result | Notes |
|---|---|---|
| `assertIntegerKobo()` throws for float, zero, NaN | ✅ PASS | `!Number.isInteger()` catches floats and NaN; explicit `=== 0` check for zero. |
| `postLedgerEntry()` — no UPDATE/DELETE on float_ledger | ✅ PASS | Only operations: `UPDATE agent_wallets` (balance) and `INSERT INTO float_ledger`. No mutation of ledger rows. |
| `reverseLedgerEntry()` creates new row (not mutate) | ✅ PASS | Calls `postLedgerEntry()` with `amountKobo: -original.amount_kobo` — new row, opposite sign. |
| `db.batch([stmt1, stmt2])` for atomicity | ✅ PASS | Wallet update + ledger insert batched atomically. |
| `createAgentWallet()` idempotent on UNIQUE violation | ✅ PASS | Catches UNIQUE constraint error and returns existing wallet id. |
| `InsufficientFloatError` is named class | ✅ PASS | `class InsufficientFloatError extends Error` — `instanceof` checks work correctly. |

### 5. apps/api — POST /sync/apply

| Check | Result | Notes |
|---|---|---|
| Valid request → `200 { applied: true, clientId }` | ✅ PASS | Confirmed by sync.test.ts |
| Duplicate `clientId` (status=applied) → `200 { idempotent: true }` | ✅ PASS | Application-level idempotency check before insert. DB-level UNIQUE constraint added (Fix #2). |
| `clientId` with status=conflict → `409` | ✅ PASS | `existing.status === 'conflict'` → `c.json({ conflict: true }, 409)` |
| Missing `clientId` → `400` | ✅ PASS | |
| Missing `entity` → `400` | ✅ PASS | |
| Unsupported entity type → `400` with 'not syncable' | ✅ PASS | `isAllowedEntity()` check; error message includes "is not syncable" |
| Invalid operation → `400` | ✅ PASS | |
| Malformed JSON → `400` | ✅ PASS | `.catch(() => null)` + null check |
| `auth.tenantId` bound in D1 writes (T3) | ✅ PASS | `WHERE client_id = ? AND tenant_id = ?` + INSERT binds `tenantId` |
| Route protected by `authMiddleware` → `401` without JWT | ✅ PASS | Applied in `apps/api/src/index.ts` under `app.use('/sync/*', authMiddleware)` |

### 6. apps/api — POS routes

| Check | Result | Notes |
|---|---|---|
| `POST /pos/terminals` → `201` with `terminalRef` | ✅ PASS | |
| `POST /pos/terminals` — missing `terminalRef` → `400` | ✅ PASS | Zod validation |
| `POST /pos/float/credit` with `amountKobo: 100.5` → `400` | ✅ PASS | `z.number().int()` rejects floats |
| `POST /pos/float/debit` when balance < debit → `422` | ✅ PASS | `InsufficientFloatError` caught → 422 |
| `GET /pos/float/balance` — `balanceKobo` always integer | ✅ PASS | D1 stores as `INTEGER`; no float conversion in route |
| `GET /pos/float/balance` — not found → `404` | ✅ PASS | `if (!balance) return c.json({ error: ... }, 404)` |
| `GET /pos/float/history` — T3 verified wallet ownership | ✅ PASS | `WHERE id = ? AND tenant_id = ?` check before returning entries |
| `GET /pos/float/history` — wrong-tenant wallet → `404` | ✅ PASS | Same T3 check returns 404 |
| `POST /pos/float/reverse` — new ledger row (not mutate) | ✅ PASS | `reverseLedgerEntry()` creates new row via `postLedgerEntry()` |
| All 6 POS routes → `401` without JWT | ✅ PASS | Applied via `app.use('/pos/*', authMiddleware)` in `index.ts` |

### 7. CORS advisory fix

| Check | Result | Notes |
|---|---|---|
| CORS reads `c.env.ALLOWED_ORIGINS` at request time | ✅ PASS | Inside `app.use('*', async (c, next) => {...})` — not a module-level constant |
| `Env` interface has `ALLOWED_ORIGINS?: string` | ✅ PASS | Added to `apps/api/src/env.ts` |
| Origin function returns `null` for non-allowed origins | ✅ PASS | `origin: (origin) => (allowed.includes(origin) ? origin : null)` |
| Fallback when unset | ✅ PASS | `['https://*.webwaka.com', 'http://localhost:5173']` |

### 8. Dependency hygiene

| Check | Result | Notes |
|---|---|---|
| `packages/identity/package.json` — no `@webwaka/core` | ✅ PASS | Only `@webwaka/types` in dependencies |
| `packages/community/package.json` — no `@webwaka/core`, valid JSON | ✅ PASS | |
| `packages/otp/package.json` — no `@webwaka/core`, valid JSON | ✅ PASS | |
| `packages/social/package.json` — no `@webwaka/core`, valid JSON | ✅ PASS | |
| `apps/ussd-gateway/package.json` — no `@webwaka/core`; `hono` present | ✅ PASS | `hono: ^4.12.12` in dependencies |
| `apps/api/package.json` — `zod` and `@webwaka/pos: workspace:*` present | ✅ PASS | Both confirmed in dependencies |
| `packages/offline-sync/package.json` — `dexie` in deps; `fake-indexeddb` and `jsdom` in devDeps | ✅ PASS | `dexie: ^3.2.7`, `fake-indexeddb: ^6.0.0`, `jsdom: ^24.0.0` |

### 9. Code quality & security

| Check | Result | Notes |
|---|---|---|
| No `console.log` in production paths | ✅ PASS | Scanned all new route and package files — none found |
| No hardcoded secrets, IDs, or monetary amounts | ✅ PASS | All sensitive values read from `c.env.*` |
| No `as any` casts in production files | ✅ PASS | `c.env.DB as unknown as D1Like` pattern used consistently |
| `D1Like` interface defined correctly per file | ✅ PASS | Separate `D1BoundStmt` + `D1Like` interfaces in each new route file |
| `X-User-Id` extracted from JWT `sub` claim | ✅ PASS | `extractUserIdFromBearer(authHeader)` in `audit-log.ts` — NOT from client-supplied header |

---

## Issues Found and Fixed

| # | Severity | File:Line | Description | Fix Applied |
|---|---|---|---|---|
| 1 | **High** | `apps/api/vitest.config.ts:19` | `@webwaka/pos` alias missing from vitest resolve config → 5 of 7 test suites failed to load (including `pos.test.ts`, `sync.test.ts`, `api.test.ts`, `discovery.test.ts`, `public.test.ts`) | Added `'@webwaka/pos': path.resolve(__dirname, '../../packages/pos/src/index.ts')` to alias map |
| 2 | **High** | `apps/api/tsconfig.json:21` | `@webwaka/pos` path alias missing from tsconfig → TypeScript could not resolve the module, causing cascading error `TS18046 ('err' is of type 'unknown')` at `pos.ts:219` | Added `"@webwaka/pos": ["../../packages/pos/src/index.ts"]` to paths |
| 3 | **High** | `infra/db/migrations/0025_agent_sessions_sync.sql:27` | `client_id` lacked a `UNIQUE` constraint — only an index existed. P11 requires DB-level idempotency enforcement to prevent duplicate entries under race conditions | Changed `client_id TEXT NOT NULL` → `client_id TEXT NOT NULL UNIQUE` |
| 4 | **Medium** | `infra/db/migrations/0025_agent_sessions_sync.sql:32` | `status` column defaulted to `'received'` and CHECK included `'received'` and `'rejected'` — neither value is used by `sync.ts` and both are absent from the QA spec | Changed DEFAULT to `'pending'`; updated CHECK to `('pending', 'applied', 'conflict')` |

---

## Advisory Carry-overs Confirmed

### TDR advisory — issue #23: users ↔ individuals identity model
- **Status:** ✅ Confirmed filed (issue #23 per QA brief)
- The `users` table (migration 0013) is the auth-layer identity (email/phone → JWT). The `individuals` table (migration 0002) is the directory entity (person profile). Separation is intentional and architecturally sound. TDR documents this bifurcation.

### CORS fix (M7a advisory)
- **Status:** ✅ Fully resolved
- `ALLOWED_ORIGINS` is read from `c.env` at request time (not module-level constant). `env.ts` declares `ALLOWED_ORIGINS?: string`. Origin function returns `null` for non-allowed origins (no wildcard pass-through). Fallback to development defaults when unset.

### X-User-Id header source (M7a advisory)
- **Status:** ✅ Confirmed safe
- `audit-log.ts` calls `extractUserIdFromBearer(authHeader)` which derives `userId` from the verified JWT Bearer token. The middleware does NOT accept `X-User-Id` from client-supplied headers. No injection risk.

### USSD session tenantId (T3 — Advisory, not blocking)
- **Status:** ⚠️ Advisory — escalated, no fix applied
- The USSD KV session key uses `ussd:{sessionId}` without a `tenantId` prefix. Africa's Talking sessionIds are globally unique UUIDs per dial session, so cross-tenant contamination at the KV layer is not possible in the current single-shortcode architecture. All financial operations initiated from USSD flow through the API layer (which enforces full JWT auth + T3). Adding `tenantId` to USSD session keys requires a phone-number → tenant resolution step that is outside M7b scope and requires architectural input. Recommend filing as M7c follow-up item.

---

## Pre-existing Issues (not M7b regressions)

Per QA brief — these were noted and not raised as M7b defects:
- `@webwaka/community` has no test files — pre-existing
- `eslint@8.57.1` deprecation warning in pnpm output — pre-existing upstream issue
- Vitest CJS build deprecation warning — pre-existing Vite upstream issue

---

## Final Verdict

```
APPROVED WITH FIXES
```

**4 issues found and fixed (2 High, 1 High, 1 Medium).**
**0 blockers remaining.**
**178 tests passing. 0 typecheck errors.**

All M7b platform invariants (P6, P9, P11, T3, T4) are correctly enforced. The implementation is architecturally sound and consistent with established patterns across the codebase. Ready to merge to `main`.

---

*Signed: QA Agent — WebWaka OS M7b QA Review 2026-04-08*
*Fixes committed to `feat/m7b-offline-ussd-pos`*
