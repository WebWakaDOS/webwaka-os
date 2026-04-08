# M7b QA Brief — Offline Sync + USSD Gateway + POS Float Ledger

**Date:** 2026-04-08
**Milestone:** 7b
**Branch under review:** `feat/m7b-offline-ussd-pos`
**PR:** [#24](https://github.com/WebWakaDOS/webwaka-os/pull/24) — closes issue [#22](https://github.com/WebWakaDOS/webwaka-os/issues/22)
**Preceding milestone baseline:** M7a — PR [#21](https://github.com/WebWakaDOS/webwaka-os/pull/21), commit `d629339`
**TDR advisory filed this milestone:** [issue #23](https://github.com/WebWakaDOS/webwaka-os/issues/23) (users ↔ individuals identity model)

---

## Role

You are a **senior QA engineer and TypeScript/Cloudflare Workers expert**. Your job is not limited to finding issues — you are expected to **find and fix every issue you discover**, then commit the fixes to the `feat/m7b-offline-ussd-pos` branch and update PR #24 with a summary of what was found and corrected. Only escalate to a human if a fix would require a fundamental architectural change outside the scope of this milestone.

Your final output must be a **QA report committed to `docs/qa/m7b-qa-report.md`** on the same branch.

---

## Stack Reference

- **Runtime:** Cloudflare Workers (edge-first, no Node.js APIs in production code)
- **Language:** TypeScript strict mode (`exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`)
- **API framework:** Hono
- **Database:** Cloudflare D1 (SQLite at the edge)
- **Cache / session:** Cloudflare KV
- **Offline sync:** Dexie.js + Service Worker Background Sync API
- **Validation:** Zod (`z.number().int()` for all monetary inputs)
- **Package manager:** pnpm workspaces (`pnpm-workspace.yaml` covers `apps/*`, `packages/*`, `packages/core/*`)
- **Test runner:** Vitest (node env for most; jsdom env for offline-sync)

---

## What M7b Delivered

| Deliverable | Location | Key files |
|---|---|---|
| DB Migrations 0022–0025 | `infra/db/migrations/` | `0022_agents.sql` `0023_pos_terminals.sql` `0024_float_ledger.sql` `0025_agent_sessions_sync.sql` |
| packages/offline-sync | `packages/offline-sync/src/` | `adapter.ts` `sync-engine.ts` `db.ts` `offline-indicator.ts` `service-worker.ts` `utils.ts` |
| apps/ussd-gateway | `apps/ussd-gateway/src/` | `session.ts` `menus.ts` `processor.ts` `index.ts` |
| packages/pos | `packages/pos/src/` | `float-ledger.ts` `terminal.ts` `wallet.ts` |
| apps/api new routes | `apps/api/src/routes/` | `sync.ts` `pos.ts` |
| apps/api CORS fix | `apps/api/src/index.ts` `apps/api/src/env.ts` | env-driven `ALLOWED_ORIGINS` |

---

## Platform Invariants — Non-Negotiable

These are hardcoded constraints that, if violated, constitute a **critical defect** requiring immediate fix before PR merge.

### P6 — Offline queue never drops operations
- Location: `packages/offline-sync/src/adapter.ts`
- Rule: failed sync operations must be re-queued with backoff, not silently discarded
- Test file: `packages/offline-sync/src/adapter.test.ts`

### P9 + T4 — All monetary values are integer kobo, never floats
- Locations:
  - `packages/pos/src/float-ledger.ts` → `assertIntegerKobo()`
  - `apps/api/src/routes/pos.ts` → Zod `z.number().int()`
  - `apps/ussd-gateway/src/menus.ts` → display formatting
- Rule: no `parseFloat`, no floating-point division, no `toFixed()`, no `Math.round()` on money, no `0.1 + 0.2` style arithmetic anywhere in the monetary path
- A `POST /pos/float/credit` with `amountKobo: 100.5` must return `400`

### P11 — Server-wins FIFO; idempotent replay
- Locations:
  - `packages/offline-sync/src/sync-engine.ts`
  - `apps/api/src/routes/sync.ts`
  - Migration `0025_agent_sessions_sync.sql` (`client_id UNIQUE`)
- Rules:
  - Same `clientId` sent twice → second call returns `{ idempotent: true }` with `200`, never an error
  - Conflict → `409 { conflict: true }`, never `500`
  - Server state always overwrites client state on conflict

### T3 — Tenant isolation on every DB query
- Locations: all routes in `apps/api/src/routes/pos.ts` and `apps/api/src/routes/sync.ts`
- Rule: every `db.prepare(...)` that reads or writes tenant-scoped data must bind `auth.tenantId` in its WHERE clause — no full-table scans on multi-tenant tables

---

## Environment Setup

```bash
# Install all dependencies (the @webwaka/core stale-dep bug was fixed in M7b)
pnpm install

# Run all M7b test suites
pnpm --filter @webwaka/offline-sync run test   # expect ≥29 tests passing
pnpm --filter @webwaka/ussd-gateway run test   # expect ≥41 tests passing
pnpm --filter @webwaka/pos run test            # expect ≥17 tests passing
pnpm --filter @webwaka/api run test            # expect ≥91 tests passing

# Full typecheck — must return 0 errors
pnpm --filter @webwaka/offline-sync \
     --filter @webwaka/ussd-gateway \
     --filter @webwaka/pos \
     --filter @webwaka/api \
     run typecheck
```

---

## QA Checklist

Work through every item. For each failure: **fix it, verify the fix, then mark it resolved in your report.**

### 1. DB Migrations

- [ ] `0022_agents.sql` — `agents` table has `tenant_id TEXT NOT NULL`, `id` as PK, correct FK references
- [ ] `0023_pos_terminals.sql` — `pos_terminals` has `agent_id` FK, `tenant_id TEXT NOT NULL`, status column with a constrained enum or CHECK constraint
- [ ] `0024_float_ledger.sql` — `amount_kobo INTEGER NOT NULL`, `running_balance_kobo INTEGER NOT NULL`; no UPDATE/DELETE triggers that would allow row mutation (append-only enforcement)
- [ ] `0025_agent_sessions_sync.sql` — `client_id` has a `UNIQUE` constraint; `status` column defaults to `'pending'`; valid status values are `applied`, `conflict`, `pending`

### 2. packages/offline-sync

- [ ] `adapter.ts` — `dequeue()` returns the oldest item first (FIFO); failed items are re-queued, not dropped (P6)
- [ ] `adapter.ts` — no item is silently lost if Dexie throws during a transaction
- [ ] `sync-engine.ts` — on conflict, local state is fully overwritten by server state (server-wins), not merged or partially applied
- [ ] `sync-engine.ts` — retry uses exponential backoff from `utils.ts`, not `setInterval` with fixed delay
- [ ] `utils.ts` — contains no monetary arithmetic (P9 not applicable here, but verify no accidental float math)
- [ ] `db.ts` — Dexie schema version is explicit; upgrade path defined
- [ ] `service-worker.ts` — SW registration is guarded by `'serviceWorker' in navigator` before calling `register()`
- [ ] Test coverage: FIFO ordering across multiple enqueue/dequeue cycles; conflict overwrites local; backoff increases on repeated failure; idempotent replay

### 3. apps/ussd-gateway

- [ ] `session.ts` — KV TTL is exactly `180` seconds in `expirationTtl`; session key includes `tenantId` (T3)
- [ ] `session.ts` — session is cleared (`DELETE`) after a terminal `END` response, not left to TTL-expire
- [ ] `menus.ts` — Naira display uses integer division only: `Math.floor(kobo / 100)` or equivalent — never `toFixed`, never `parseFloat` (P9)
- [ ] `menus.ts` — all menu branches that return `CON` have a non-empty prompt; all terminal branches return `END`
- [ ] `processor.ts` — unknown FSM states produce an `END` response with a user-friendly message, not an unhandled exception
- [ ] `index.ts` — parses Africa's Talking POST body fields correctly: `text`, `sessionId`, `phoneNumber`, `serviceCode`, `networkCode`
- [ ] `index.ts` — response `Content-Type` is `text/plain` (Africa's Talking requirement, not `application/json`)
- [ ] Test coverage: session TTL creation and retrieval; menu CON/END distinction for every branch; multi-step flow (balance check → show balance; topup flow; transfer flow)

### 4. packages/pos

- [ ] `float-ledger.ts` — `assertIntegerKobo()` throws for: float input, zero, NaN, negative (credit must be positive)
- [ ] `float-ledger.ts` — `postLedgerEntry()` never issues `UPDATE` or `DELETE` on `float_ledger` rows
- [ ] `float-ledger.ts` — `reverseLedgerEntry()` creates a **new row** with `amountKobo = -original.amount_kobo` (equal and opposite); never mutates the original row
- [ ] `float-ledger.ts` — `db.batch([stmt1, stmt2])` is used for the wallet balance update + ledger insert (atomicity)
- [ ] `wallet.ts` — `createAgentWallet()` handles `UNIQUE` constraint violation (idempotent; returns existing wallet id, not crash)
- [ ] `InsufficientFloatError` is a named class (`extends Error`) so callers can use `instanceof InsufficientFloatError`
- [ ] Test coverage: credit updates balance; debit updates balance; debit at exact balance succeeds; debit above balance throws `InsufficientFloatError`; reversal creates new row; float and zero inputs rejected by `assertIntegerKobo`

### 5. apps/api — POST /sync/apply

- [ ] Valid new request → `200 { applied: true, clientId }`
- [ ] Duplicate `clientId` with status `applied` → `200 { idempotent: true }` (not `409`, not `500`)
- [ ] `clientId` with status `conflict` → `409 { conflict: true }`
- [ ] Missing `clientId` → `400`
- [ ] Missing `entity` → `400`
- [ ] Unsupported entity type (e.g. `random_entity`) → `400` with error message containing `not syncable`
- [ ] Invalid operation (e.g. `upsert`) → `400`
- [ ] Malformed JSON body → `400` (not `500`)
- [ ] `auth.tenantId` is bound in all D1 writes (T3)
- [ ] Route is protected by `authMiddleware` (returns `401` without a valid JWT)

### 6. apps/api — POS routes

- [ ] `POST /pos/terminals` — returns `201` with `terminalRef`; returns `400` for missing `terminalRef`
- [ ] `POST /pos/float/credit` with `amountKobo: 100.5` → `400` (Zod P9 enforcement)
- [ ] `POST /pos/float/debit` when balance < debit amount → `422` (not `500`) via `InsufficientFloatError` catch
- [ ] `GET /pos/float/balance` — response `balanceKobo` is always a JavaScript integer (`Number.isInteger(balanceKobo) === true`)
- [ ] `GET /pos/float/balance` — returns `404` when wallet not found (not `500`)
- [ ] `GET /pos/float/history` — only returns ledger entries belonging to the authenticated tenant (T3); returns `404` for wrong-tenant wallet
- [ ] `POST /pos/float/reverse` — creates a new ledger row (confirmed via the ledger `id` in the response); does not mutate the original row
- [ ] All 6 POS routes return `401` without a valid JWT

### 7. CORS advisory fix

- [ ] `apps/api/src/index.ts` — CORS middleware reads `c.env.ALLOWED_ORIGINS` at request time (not a module-level constant)
- [ ] `apps/api/src/env.ts` — `ALLOWED_ORIGINS?: string` is present in the `Env` interface
- [ ] Origin function returns `null` (deny) for origins not in the list — not a wildcard pass-through
- [ ] Fallback when `ALLOWED_ORIGINS` is unset: `['https://*.webwaka.com', 'http://localhost:5173']`

### 8. Dependency hygiene

- [ ] `packages/identity/package.json` — no `@webwaka/core` entry
- [ ] `packages/community/package.json` — no `@webwaka/core` entry; valid JSON (no trailing commas)
- [ ] `packages/otp/package.json` — no `@webwaka/core` entry; valid JSON
- [ ] `packages/social/package.json` — no `@webwaka/core` entry; valid JSON
- [ ] `apps/ussd-gateway/package.json` — no `@webwaka/core` entry; `hono` present in dependencies
- [ ] `apps/api/package.json` — `zod` and `@webwaka/pos: workspace:*` present in dependencies
- [ ] `packages/offline-sync/package.json` — `dexie` in dependencies; `fake-indexeddb` and `jsdom` in devDependencies

### 9. Code quality & security

- [ ] No `console.log` in production paths (only `console.warn`/`console.error` in error handlers)
- [ ] No hardcoded secrets, tenant IDs, user IDs, or monetary amounts in runtime code
- [ ] No `as any` casts in new production files (test files may use `as unknown as T` for mocking — acceptable)
- [ ] `c.env.DB as unknown as D1Like` pattern used consistently (not `as any`) across all new routes
- [ ] `D1Like` local interface in each new file defines `D1BoundStmt` correctly (not the old recursive `ReturnType<D1Like['prepare']>['bind']` pattern)

---

## Known Pre-existing Issues — Do Not Raise as M7b Regressions

- `@webwaka/community` has no test files — pre-existing, not introduced in M7b
- `eslint@8.57.1` deprecation warning in pnpm output — pre-existing upstream issue
- Vitest CJS build deprecation warning — pre-existing Vite upstream issue

---

## Fixing Issues

When you find a defect:

1. Identify the exact file and line
2. Determine the correct fix consistent with the platform invariants and the patterns already established in the codebase
3. Apply the fix
4. Re-run the affected test suite to confirm it passes
5. Re-run typecheck to confirm 0 errors
6. Document the fix in your QA report with: what was wrong, what you changed, file:line reference

Commit all fixes to `feat/m7b-offline-ussd-pos` with commit message format:
```
fix(m7b-qa): <short description of what was corrected>
```

---

## QA Report Format

Commit your completed report to `docs/qa/m7b-qa-report.md` on `feat/m7b-offline-ussd-pos` using this structure:

```markdown
# M7b QA Report

**Date:** YYYY-MM-DD
**Reviewer:** QA Agent
**Verdict:** APPROVED | APPROVED WITH FIXES

## Test Results
| Package | Expected | Actual | Status |
...

## Typecheck
...

## Invariant Audit
| Invariant | Files Checked | Result | Notes |
...

## Checklist Results
### 1. DB Migrations ...
### 2. packages/offline-sync ...
...

## Issues Found and Fixed
| # | Severity | File:Line | Description | Fix Applied |
...

## Advisory Carry-overs Confirmed
- TDR issue #23: ...
- CORS fix: ...
- X-User-Id: ...

## Final Verdict
...
```

---

## Severity Definitions

| Level | Meaning |
|---|---|
| **Critical** | Platform invariant violated (P6/P9/P11/T3), data loss risk, or security hole — must fix before merge |
| **High** | Incorrect behaviour in a primary happy path or missing auth guard — must fix before merge |
| **Medium** | Edge case not handled, missing test coverage for a documented requirement — fix and add test |
| **Low** | Code style, missing JSDoc, minor naming inconsistency — fix if quick, otherwise note |
| **Advisory** | Improvement suggestion with no current impact — note only, no fix required |
