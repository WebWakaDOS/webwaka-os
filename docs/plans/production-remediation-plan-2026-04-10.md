# WebWaka Production Remediation Plan

**Source:** Production Readiness Audit — `docs/reports/production-readiness-audit-2026-04-10.md`
**Target:** 100% production-ready
**Timeline:** 90 days (Weeks 1–12)
**Success Criteria:** Zero blockers, all CI checks pass, 10k+ Nigerian users on Day 1
**Audit Repo State:** `09f707d` / Updated: `da0d175`
**Platform invariants:** P9 all money INTEGER kobo · T3 tenant_id everywhere · P14 DMs AES-GCM · no floats

---

## PHASE 1: CRITICAL BLOCKERS (Week 1–2)

**Risk:** Production deployment literally impossible — zero users can be served
**Est Total:** ~12 dev-days

---

### Task 1.1: Create `apps/api/src/types.ts` — Shared API Types File

**Priority:** BLOCKER (B-06)
**Est:** 2h
**Files:**
- `apps/api/src/types.ts` (CREATE)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] File exists at `apps/api/src/types.ts` with correct ES module export syntax
- [ ] All shared types used across extended route bundles are exported (`AuthContext`, `PaginationQuery`, `ApiResponse<T>`, `D1Like`, `HonoEnv`)
- [ ] `npx tsc --noEmit -p apps/api/tsconfig.json` reduces errors by exactly 47 (the `Cannot find module '../types.js'` class)
- [ ] No existing import in any file is broken by the addition of this file
- [ ] File includes JSDoc comment linking to platform-invariants.md
- [ ] `HonoEnv` type correctly extends `{ Bindings: Env }` with the `Variables` shape from `authMiddleware`
- [ ] `ApiResponse<T>` includes `ok: boolean`, `data?: T`, `error?: { code: string; message: string }`

**Implementation Steps:**
1. Grep all extended route bundles for their `from '../types.js'` import to identify every type they need
2. Collect the union of all imported identifiers across all 47 files
3. Cross-reference with `apps/api/src/middleware/auth.ts` to get the `AuthContext` shape exactly
4. Write `apps/api/src/types.ts` exporting each type with strict `exactOptionalPropertyTypes` compliance
5. Verify `interface HonoEnv { Bindings: Env; Variables: { auth: AuthContext } }` matches what `c.get('auth')` casts produce
6. Run `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "types.js" | wc -l` — must reach 0

**QA Verification:**
1. `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "Cannot find module '..\/types.js'"` → zero lines returned
2. `grep -r "from '../types.js'" apps/api/src/routes/ | wc -l` → count matches; each resolves cleanly
3. Manually import `ApiResponse` in a scratch file and confirm TypeScript infers `data` as optional — `const r: ApiResponse<string> = { ok: true }` compiles without error

**Risk if skipped:** 47 route files remain broken; `pnpm typecheck` cannot pass; staging CI gate never opens; platform cannot deploy.

---

### Task 1.2: Wire Cloudflare D1 + KV IDs into All `wrangler.toml` Files

**Priority:** BLOCKER (B-01)
**Est:** 1h
**Files:**
- `apps/api/wrangler.toml`
- `apps/brand-runtime/wrangler.toml`
- `apps/public-discovery/wrangler.toml`
- `apps/ussd-gateway/wrangler.toml`
**Dependencies:** []

**Acceptance Criteria:**
- [ ] Zero occurrences of the string `placeholder-replace-with-actual-id` in any `wrangler.toml`
- [ ] Staging D1 `database_id = "cfa62668"` set in `[env.staging]` block in all applicable apps
- [ ] Production D1 `database_id = "de1d0935"` set in `[env.production]` block in all applicable apps
- [ ] `GEOGRAPHY_CACHE` KV namespace IDs (both staging and production) inserted in all apps that bind it
- [ ] `RATE_LIMIT_KV` KV namespace IDs inserted in all apps that bind it
- [ ] `THEME_CACHE` KV namespace ID inserted in `apps/brand-runtime/wrangler.toml`
- [ ] `wrangler deploy --dry-run --env staging --config apps/api/wrangler.toml` exits 0 (no missing binding errors)

**Implementation Steps:**
1. Open `docs/governance/milestone-tracker.md` and extract the 4 KV namespace IDs listed under Milestone 0
2. For each `wrangler.toml` file: replace every `"placeholder-replace-with-actual-id"` with the correct ID based on the binding name and environment
3. For empty-string `database_id = ""` fields in staging/production blocks of `brand-runtime` and `public-discovery`: insert the correct D1 IDs
4. For `ussd-gateway/wrangler.toml`: verify the comment `# Set in CI from CLOUDFLARE_D1_STAGING_ID secret` is consistent with how the workflow injects the ID, or replace with literal ID if CI injection is not configured
5. Run `grep -r "placeholder\|database_id = \"\"" --include="wrangler.toml" .` to confirm all blanks resolved
6. Commit with message `fix(infra): wire Cloudflare D1+KV IDs into all wrangler.toml files`

**QA Verification:**
1. `grep -r "placeholder-replace-with-actual-id" --include="wrangler.toml" .` → no output
2. `grep -r "database_id = \"\"" --include="wrangler.toml" .` → no output (or only comment lines)
3. `wrangler deploy --dry-run --env staging --config apps/api/wrangler.toml` → exits 0, prints "✅ D1 bindings OK"

**Risk if skipped:** Every `wrangler deploy` attempt throws binding validation error; zero Workers are ever deployed; platform is permanently offline.

---

### Task 1.3: Verify and Set GitHub Actions Cloudflare Secrets

**Priority:** BLOCKER (B-07)
**Est:** 30m
**Files:**
- `.github/workflows/deploy-staging.yml` (READ ONLY — verify expected secret names)
- `.github/workflows/deploy-production.yml` (READ ONLY)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] `CLOUDFLARE_ACCOUNT_ID` set as a GitHub Actions repository secret
- [ ] `CLOUDFLARE_API_TOKEN` set as a GitHub Actions repository secret with `Workers:Edit` + `D1:Edit` + `KV:Edit` scope
- [ ] A manual trigger of `deploy-staging.yml` on the `staging` branch exits 0 on the `wrangler deploy` step
- [ ] No "Secret not found" or `undefined` errors in the workflow run log
- [ ] The CI environment verifies secrets presence with `if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then exit 1; fi` guard (add if missing)
- [ ] GitHub Actions workflow status badge is green after first successful staging run

**Implementation Steps:**
1. Navigate to GitHub → `WebWakaDOS/webwaka-os` → Settings → Secrets and variables → Actions
2. Confirm `CLOUDFLARE_ACCOUNT_ID` exists; if not, add it from the Cloudflare Dashboard → My Profile → Account ID
3. Confirm `CLOUDFLARE_API_TOKEN` exists; if not, create a Cloudflare API Token with `Workers Scripts:Edit`, `D1:Edit`, `KV Storage:Edit` permissions scoped to the `WebWakaDOS` account
4. Open `.github/workflows/deploy-staging.yml` and verify the secret references match exactly (`${{ secrets.CLOUDFLARE_API_TOKEN }}`)
5. Add a secret presence validation step at the top of each deploy job:
   ```yaml
   - name: Validate secrets
     run: |
       [ -n "${{ secrets.CLOUDFLARE_API_TOKEN }}" ] || (echo "CLOUDFLARE_API_TOKEN not set" && exit 1)
   ```
6. Create the `staging` branch if it does not exist: `git push origin main:staging`
7. Push a no-op commit to `staging` to trigger the workflow and verify it succeeds

**QA Verification:**
1. GitHub Actions → Actions tab → `deploy-staging.yml` workflow run → all steps green
2. `curl https://webwaka-api-staging.workers.dev/health` → `{ "ok": true, "worker": "webwaka-api" }`
3. Check the workflow log for "Successfully deployed webwaka-api-staging" in wrangler output

**Risk if skipped:** Every GitHub Actions deploy job fails with "Secret not found"; CI/CD pipeline is non-functional; no automated deployments possible.

---

### Task 1.4: Create `staging` Branch and Apply 182 Migrations to Staging D1

**Priority:** BLOCKER
**Est:** 2h
**Files:**
- `infra/db/migrations/` (READ — all 182 migration files)
- `.github/workflows/deploy-staging.yml` (ADD migration apply step)
**Dependencies:** [1.2, 1.3]

**Acceptance Criteria:**
- [ ] `staging` branch exists in remote at `origin/staging`
- [ ] All 182 migrations applied to staging D1 database `cfa62668` via `wrangler d1 migrations apply`
- [ ] `wrangler d1 execute webwaka-staging --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table'"` returns the expected table count (cross-reference with migration files)
- [ ] Deploy-staging workflow includes a migration apply step before `wrangler deploy`
- [ ] If a migration fails, the CI job exits non-zero and deployment does not proceed
- [ ] The staging D1 schema matches the latest migration file (migration 0185)

**Implementation Steps:**
1. Create `staging` branch: `git checkout -b staging && git push origin staging`
2. Run locally: `wrangler d1 migrations apply webwaka-staging --remote --config apps/api/wrangler.toml --env staging`
3. Verify: `wrangler d1 execute webwaka-staging --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --remote`
4. Add a migration step to `.github/workflows/deploy-staging.yml`:
   ```yaml
   - name: Apply D1 migrations (staging)
     run: wrangler d1 migrations apply webwaka-staging --remote --env staging
     env:
       CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
       CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
   ```
5. Confirm the migration step runs before the `wrangler deploy` step
6. Push to `staging` branch and verify workflow completes successfully

**QA Verification:**
1. `wrangler d1 execute webwaka-staging --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table'" --remote` → expected table count ≥ 80
2. `wrangler d1 execute webwaka-staging --command "SELECT MAX(version) FROM d1_migrations" --remote` → returns `0185`
3. Push a second commit to `staging` after migrations are applied — workflow skips already-applied migrations and succeeds within 60 seconds

**Risk if skipped:** Staging Worker is deployed but D1 schema is empty; every API call that touches the database returns 500; platform is non-functional even after deployment.

---

### Task 1.5: Fix Hono Context Type Inconsistency Across 124 Vertical Route Files

**Priority:** BLOCKER (B-02, root cause 3)
**Est:** 3d
**Files:**
- `apps/api/src/routes/verticals/*.ts` (124 files)
- `apps/api/src/types.ts` (from Task 1.1)
**Dependencies:** [1.1]

**Acceptance Criteria:**
- [ ] All 124 vertical route files use the unified `HonoEnv` type from `'../types.js'` consistently
- [ ] Zero occurrences of `Context<Env>` (incorrect) — all changed to `Context<HonoEnv>` or route handler receives `c: Context<HonoEnv>`
- [ ] `npx tsc --noEmit -p apps/api/tsconfig.json` reduces Hono context errors to zero
- [ ] No existing route handler behaviour changes — only type annotations updated
- [ ] `c.get('auth')` resolves to `AuthContext` without any explicit `as { ... }` cast on the type-corrected routes
- [ ] All route files continue to import `Hono` from `'hono'` (no version change)
- [ ] A grep for `Context<Env>` returns zero results in `apps/api/src/routes/`

**Implementation Steps:**
1. Run `grep -rn "Context<Env>\|Context<{ Bindings" apps/api/src/routes/verticals/ | head -20` to confirm the pattern spread
2. Identify the canonical correct pattern from a working route (e.g., `apps/api/src/routes/negotiation.ts`)
3. Write a sed replacement script:
   ```bash
   find apps/api/src/routes/verticals -name "*.ts" -exec \
     sed -i 's/Context<{ Bindings: Env }>/Context<HonoEnv>/g; s/Context<Env>/Context<HonoEnv>/g' {} \;
   ```
4. Add `import type { HonoEnv } from '../types.js';` to the top of any file that now references `HonoEnv` without importing it
5. Run tsc after each batch of 20 files to catch regressions early
6. For files where `c.env` is accessed directly, verify the Env bindings are still accessible via `HonoEnv["Bindings"]`
7. Run `pnpm typecheck` from monorepo root; iterate until Hono-context errors reach zero

**QA Verification:**
1. `grep -r "Context<Env>" apps/api/src/routes/verticals/` → zero results
2. `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "Hono\|context" | wc -l` → zero
3. `curl -X GET https://webwaka-api-staging.workers.dev/api/v1/verticals/bookshop/profile/test-id -H "Authorization: Bearer <valid_jwt>"` → returns 404 with `{ ok: false, error: { code: "NOT_FOUND" } }` (not a 500)

**Risk if skipped:** 517 tsc errors remain; CI `pnpm typecheck` fails; staging deploy permanently blocked; every vertical route is unverified at the type level.

---

### Task 1.6: Fix Missing Package Exports — `MinistryRepository` and `OkadaKekeRepository.create`

**Priority:** BLOCKER (B-02, root cause 4)
**Est:** 4h
**Files:**
- `packages/verticals-ministry-mission/src/index.ts`
- `packages/verticals-okada-keke/src/repository.ts`
- `packages/verticals-okada-keke/src/index.ts`
**Dependencies:** []

**Acceptance Criteria:**
- [ ] `MinistryRepository` is exported from `@webwaka/verticals-ministry-mission`'s `index.ts`
- [ ] `OkadaKekeRepository` has a `create(input: CreateOkadaKekeInput): Promise<OkadaKeke>` method implemented
- [ ] `CreateOkadaKekeInput` type is defined and exported
- [ ] `apps/api/src/routes/civic.ts` compiles cleanly after the export fix
- [ ] `apps/api/src/routes/transport.ts` compiles cleanly after the method addition
- [ ] All new code passes `exactOptionalPropertyTypes` — no `T | undefined` assigned to optional fields without conditional spread
- [ ] Unit test added to `packages/verticals-okada-keke/src/repository.test.ts` covering `create()` happy path with mocked D1

**Implementation Steps:**
1. Open `packages/verticals-ministry-mission/src/repository.ts` and confirm `MinistryRepository` class exists
2. Add `export { MinistryRepository } from './repository.js';` (or equivalent) to `packages/verticals-ministry-mission/src/index.ts`
3. Open `packages/verticals-okada-keke/src/repository.ts`; find the existing `OkadaKekeRepository` class
4. Add `create(input: CreateOkadaKekeInput): Promise<OkadaKeke>` method following the D1 pattern used by other vertical repositories (e.g., `UsedCarRepository.create`)
5. Define `CreateOkadaKekeInput` type in `packages/verticals-okada-keke/src/types.ts` with required fields: `workspaceId`, `tenantId`, `driverName`, `phone`, `vehicleType`, `plateNumber`
6. Export `CreateOkadaKekeInput` from `packages/verticals-okada-keke/src/index.ts`
7. Write one unit test covering the `create()` method
8. Verify `civic.ts` and `transport.ts` compile: `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "ministry\|okada" | wc -l` → 0

**QA Verification:**
1. `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | grep "MinistryRepository\|OkadaKeke"` → zero lines
2. `pnpm --filter @webwaka/verticals-okada-keke test` → all tests pass
3. `curl -X POST https://webwaka-api-staging.workers.dev/api/v1/verticals/okada-keke -H "Authorization: Bearer <jwt>" -d '{"driver_name":"Emeka","phone":"08012345678","vehicle_type":"keke","plate_number":"LG1234"}' ` → `{ "ok": true, "data": { "id": "..." } }`

**Risk if skipped:** `civic.ts` and `transport.ts` route bundles fail to compile; civic and transport verticals are entirely non-functional at runtime.

---

### Task 1.7: Remove All 151 `as never` Type Casts from Vertical Route Handlers

**Priority:** BLOCKER (B-03)
**Est:** 3d
**Files:**
- `apps/api/src/routes/verticals/*.ts` (all 124 files — grep to find affected subset)
- Corresponding package `src/types.ts` files where input types need widening
**Dependencies:** [1.5]

**Acceptance Criteria:**
- [ ] `grep -r "as never" apps/api/src/routes/` → zero results
- [ ] Every `as never` removal is replaced by a proper type fix in the underlying package (no `as unknown as X` substitution)
- [ ] All enum-typed fields (e.g., `speciality`, `bppCategory`, `deliveryMethod`) have validated Zod schemas that narrow `string` to the enum type before reaching the repository call
- [ ] `guardClaimedToActive` and similar guard functions receive correctly typed arguments
- [ ] `pnpm typecheck` passes after all removals
- [ ] No existing API response shape changes — only internal types corrected
- [ ] A `CHANGELOG` entry or PR description documents every pattern that was systematically fixed

**Implementation Steps:**
1. Run `grep -rn "as never" apps/api/src/routes/verticals/ > /tmp/as-never-list.txt` to get all 151 locations grouped by file
2. Identify the 3–5 recurring patterns (enum narrowing, guard function signatures, order-items parsing, etc.)
3. For **enum fields** (e.g., `speciality as never`): add a Zod `.enum([...])` validator in the route's request schema; the narrowed type then matches the repository input type without a cast
4. For **guard functions** receiving `{} as never`: add a proper overloaded signature or a typed parameter to the guard function itself
5. For **`deliveryMethod as never`** pattern: define the `DeliveryMethod` enum in the relevant vertical's `types.ts` and widen the repository input to accept it
6. Work through the file list in batches of 20; run tsc after each batch
7. Final check: `grep -r "as never" apps/api/src/ | wc -l` → 0

**QA Verification:**
1. `grep -r "as never" apps/api/src/routes/` → zero output
2. `pnpm typecheck` from monorepo root → exits 0
3. `curl -X POST https://webwaka-api-staging.workers.dev/api/v1/verticals/catering/profile -H "Authorization: Bearer <jwt>" -d '{"workspace_id":"ws_1","business_name":"Mama Ngozi","speciality":"rice_and_stew"}'` → `{ "ok": true }` (not 500 or type error)

**Risk if skipped:** Runtime panics possible on any vertical endpoint that received an `as never`-casted argument — real user data causes unpredictable behaviour with no TypeScript safety net.

---

### Task 1.8: HMAC-Sign Price-Lock Tokens in `packages/negotiation/src/price-lock.ts`

**Priority:** BLOCKER (B-05)
**Est:** 2h
**Files:**
- `packages/negotiation/src/price-lock.ts`
- `apps/api/src/routes/negotiation.ts` (pass `PRICE_LOCK_SECRET` from Worker env)
- `apps/api/wrangler.toml` (document new secret)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] `generatePriceLock(payload, secret)` produces a token of format `<base64url-payload>.<base64url-hmac>` (two dot-separated parts)
- [ ] `verifyPriceLock(token, secret)` returns `null` if the HMAC signature does not match (constant-time comparison using `crypto.subtle.timingSafeEqual`)
- [ ] `verifyPriceLock` returns `null` if the token has expired (compare `expiresAt` with `Date.now()`)
- [ ] A token generated with secret `A` is rejected when verified with secret `B`
- [ ] A token whose payload is modified but signature kept is rejected
- [ ] The comment `// TODO: sign with HMAC-SHA256` is removed
- [ ] `wrangler.toml` documents `PRICE_LOCK_SECRET` in the secrets comment block
- [ ] Unit tests added: happy path, wrong secret, expired token, tampered payload

**Implementation Steps:**
1. Read the current `price-lock.ts` implementation to understand the payload structure
2. Replace `btoa(JSON.stringify(payload))` with:
   ```typescript
   const payloadB64 = btoa(JSON.stringify(payload)).replace(/=+$/, '');
   const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
   const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
   const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '');
   return `${payloadB64}.${sigB64}`;
   ```
3. In `verifyPriceLock`: split on `.`, recompute HMAC, use `timingSafeEqual` to compare
4. Update the negotiation route to pass `c.env.PRICE_LOCK_SECRET` as the second argument
5. Add `# PRICE_LOCK_SECRET` to the wrangler.toml secrets comment block
6. Write unit tests for all 4 acceptance criteria edge cases
7. Run `pnpm --filter @webwaka/negotiation test` → all pass

**QA Verification:**
1. Unit test: `const token = await generatePriceLock(payload, 'secret-a'); const result = await verifyPriceLock(token, 'secret-b')` → `result === null`
2. Unit test: tamper the payload between dots → `verifyPriceLock` returns `null`
3. `curl -X POST https://webwaka-api-staging.workers.dev/api/v1/negotiation/price-lock/verify -d '{"token":"forged-base64-token"}' -H "Content-Type: application/json"` → `{ "ok": false, "error": { "code": "INVALID_PRICE_LOCK" } }`

**Risk if skipped:** Any buyer can decode a price-lock token, modify `listed_price_kobo` downward, re-encode in base64, and complete a negotiation at an arbitrary price — financial fraud vector, zero cost to exploit.

---

### Task 1.9: Implement Real Paystack Workspace Activation in `workspaces.ts`

**Priority:** BLOCKER (B-04)
**Est:** 1d
**Files:**
- `apps/api/src/routes/workspaces.ts`
- `packages/payments/src/paystack.ts` (READ — use existing client)
- `packages/payments/src/types.ts` (READ)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] `POST /workspaces/:id/activate` calls `packages/payments` `initializeTransaction()` with the workspace owner's email and the plan price in kobo
- [ ] Response contains a real Paystack `authorization_url` and `reference` (not `stub_*`)
- [ ] The stub comment and `stub_` string are fully removed from the file
- [ ] The workspace `status` field is set to `pending_payment` (not `active`) until Paystack webhook confirms payment
- [ ] `POST /payments/webhook` (Paystack webhook handler) updates the workspace to `active` upon `charge.success` event for the workspace's reference
- [ ] The `PAYSTACK_SECRET_KEY` Worker secret is validated to exist before the route is called (middleware guard)
- [ ] An integration test covers the `initializeTransaction → webhook → workspace active` flow with mocked Paystack responses

**Implementation Steps:**
1. Read `packages/payments/src/paystack.ts` to understand `initializeTransaction(email, amountKobo, reference, metadata)` signature
2. In `workspaces.ts`, replace the stub block with:
   ```typescript
   const paystack = new PaystackClient(c.env.PAYSTACK_SECRET_KEY);
   const ref = crypto.randomUUID().replace(/-/g, '');
   const init = await paystack.initializeTransaction({
     email: workspace.owner_email,
     amount: planPriceKobo,
     reference: ref,
     callback_url: `${c.env.APP_BASE_URL}/billing/verify?ref=${ref}`,
     metadata: { workspace_id: id, tenant_id: auth.tenantId, plan: body.plan },
   });
   await db.prepare('UPDATE workspaces SET status=?, paystack_ref=? WHERE id=? AND tenant_id=?')
     .bind('pending_payment', ref, id, auth.tenantId).run();
   return c.json({ ok: true, data: { authorization_url: init.authorization_url, reference: ref } });
   ```
3. In `payments.ts` webhook handler: match `charge.success` events where `metadata.workspace_id` is set; update workspace status to `active`
4. Add `PAYSTACK_SECRET_KEY` env check middleware at the start of the route
5. Write an integration test with a Paystack mock

**QA Verification:**
1. `curl -X POST https://webwaka-api-staging.workers.dev/api/v1/workspaces/ws_test/activate -H "Authorization: Bearer <jwt>" -d '{"plan":"basic"}'` → `{ "ok": true, "data": { "authorization_url": "https://checkout.paystack.com/...", "reference": "<uuid>" } }` (no `stub_` in reference)
2. Simulate Paystack webhook `charge.success` with matching reference → workspace row in D1 has `status = 'active'`
3. `grep -r "stub_" apps/api/src/routes/workspaces.ts` → zero results

**Risk if skipped:** No workspace can ever be upgraded from free to paid; platform revenue is zero; all partner SaaS subscriptions are non-functional.

---

### Task 1.10: Resolve All Remaining tsc Errors — Target: `pnpm typecheck` Exits 0

**Priority:** BLOCKER (B-02)
**Est:** 2d
**Files:**
- All files with remaining errors after Tasks 1.1, 1.5, 1.6, 1.7
- `apps/api/tsconfig.json` (verify `paths` aliases are correct)
**Dependencies:** [1.1, 1.5, 1.6, 1.7]

**Acceptance Criteria:**
- [ ] `pnpm typecheck` from monorepo root exits 0 with no errors
- [ ] `npx tsc --noEmit -p apps/api/tsconfig.json` exits 0
- [ ] All 8 app `tsconfig.json` files produce zero errors when run independently
- [ ] No `// @ts-ignore` or `// @ts-expect-error` introduced (if unavoidable, each must have a linking comment to a filed GitHub Issue)
- [ ] CI `typecheck` step in `.github/workflows/ci.yml` goes green on next push
- [ ] No `as unknown as X` substitution for `as never` (a lateral escape still unsound)

**Implementation Steps:**
1. After Tasks 1.1, 1.5, 1.6, 1.7: run `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -60` to see remaining errors
2. Group remaining errors by category; fix the highest-frequency category first
3. For `@cloudflare/workers-types` resolution errors in individual packages: ensure `@cloudflare/workers-types` is in the root `devDependencies` of the monorepo and hoisted correctly by pnpm
4. For remaining missing exports: add them to the relevant package's `index.ts`
5. For any truly irresolvable error due to an upstream library type mismatch: use `// @ts-expect-error — see GH#<n>` and file a GitHub Issue immediately
6. Verify all 8 app `tsconfig.json` files individually
7. Push to `staging` branch and verify CI `typecheck` step passes

**QA Verification:**
1. `pnpm typecheck` from repo root → exits 0, "0 errors" in output
2. GitHub Actions CI run on `staging` branch → `typecheck` step shows green checkmark
3. `npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | wc -l` → 0

**Risk if skipped:** CI remains permanently broken; no protected deployments are ever possible; every deploy requires manually bypassing the branch protection rule.

---

## PHASE 2: HIGH PRIORITY (Week 3–4)

**Risk:** >10% user impact — security incidents, developer paralysis, silent failures, billing failures
**Est Total:** ~14 dev-days (excluding partner-admin portal which is 2 weeks)

---

### Task 2.1: Add Global Rate Limiting to All Authenticated API Endpoints

**Priority:** HIGH (H-01)
**Est:** 4h
**Files:**
- `apps/api/src/middleware/rate-limit.ts` (MODIFY or CREATE)
- `apps/api/src/index.ts` (add global middleware)
- `apps/api/wrangler.toml` (confirm `RATE_LIMIT_KV` binding present)
**Dependencies:** [1.10]

**Acceptance Criteria:**
- [ ] A global `rateLimitMiddleware` is applied with `app.use('/api/*', rateLimitMiddleware)` before all authenticated route registrations
- [ ] Default limit: 100 requests per 60-second window per `tenant_id` (extracted from JWT auth)
- [ ] Unauthenticated routes (`/health`, `/discover/*`, `/geography/*`) have a separate IP-based limit of 300/min
- [ ] Responses exceeding the limit return HTTP 429 with `{ "ok": false, "error": { "code": "RATE_LIMIT_EXCEEDED", "retryAfter": <seconds> } }`
- [ ] `Retry-After` response header is set on 429 responses
- [ ] Rate limit counters are stored in `RATE_LIMIT_KV` using key pattern `rl:<tenant_id>:<window_epoch>`
- [ ] Vertical-specific overrides: identity verify = 2/hr per IP (existing, must not regress); OTP = 5/min per phone (existing, must not regress); negotiation = 20/min per tenant

**Implementation Steps:**
1. Read existing `identityRateLimit` and OTP rate limit implementations to understand the KV-based pattern
2. Extract a reusable `createRateLimiter({ windowSecs, limit, keyFn })` factory function
3. Create a global `tenantRateLimiter` instance: 100/60s keyed by `auth.tenantId`
4. Create a `publicIpRateLimiter` instance: 300/60s keyed by `c.req.header('CF-Connecting-IP')`
5. Apply in `apps/api/src/index.ts`:
   - Before auth middleware: `app.use('/api/v1/geography/*', publicIpRateLimiter)`
   - After auth middleware: `app.use('/api/v1/*', tenantRateLimiter)`
6. Add `Retry-After` header computation in the 429 response
7. Write tests for: limit not reached (passes), limit reached (429), window reset (passes again after TTL)

**QA Verification:**
1. `for i in {1..105}; do curl -s -o /dev/null -w "%{http_code}" https://webwaka-api-staging.workers.dev/api/v1/geography/places -H "Authorization: Bearer <jwt>"; done | sort | uniq -c` → first 100 return `200`, remaining return `429`
2. `curl -X GET https://webwaka-api-staging.workers.dev/api/v1/geography/places -H "Authorization: Bearer <jwt>"` after 60 seconds → `200` again (window reset)
3. `curl -X POST https://webwaka-api-staging.workers.dev/api/v1/identity/verify-bvn -d '{"bvn":"12345678901"}' -H "Authorization: Bearer <jwt>"` (3rd attempt within 1 hour) → `429` with `code: "RATE_LIMIT_EXCEEDED"` (existing identity limit not regressed)

**Risk if skipped:** Platform is trivially abusable — a single compromised tenant JWT can DoS the D1 database with thousands of writes/sec; competitor scraping of the discovery index is unimpeded; OTP endpoints open to enumeration.

---

### Task 2.2: Add Security Headers to Main API (Hono `secureHeaders` Middleware)

**Priority:** HIGH (H-05)
**Est:** 30m
**Files:**
- `apps/api/src/index.ts`
**Dependencies:** [1.10]

**Acceptance Criteria:**
- [ ] `import { secureHeaders } from 'hono/secure-headers'` added and `app.use('/*', secureHeaders())` applied as the first middleware
- [ ] API responses include `X-Content-Type-Options: nosniff`
- [ ] API responses include `X-Frame-Options: DENY`
- [ ] API responses include `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] API responses include `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HSTS)
- [ ] CORS headers are not broken by the addition (test an OPTIONS preflight request)
- [ ] The existing `cors()` middleware remains applied correctly after `secureHeaders()`

**Implementation Steps:**
1. Add `import { secureHeaders } from 'hono/secure-headers';` at the top of `apps/api/src/index.ts`
2. Add `app.use('/*', secureHeaders());` as the first `app.use` call, before CORS
3. Verify CORS still works: `app.use('/*', cors({ ... }))` should come immediately after secureHeaders
4. Run locally and inspect response headers with `curl -I`

**QA Verification:**
1. `curl -I https://webwaka-api-staging.workers.dev/health` → response includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000`
2. `curl -X OPTIONS https://webwaka-api-staging.workers.dev/api/v1/geography/places -H "Origin: https://app.webwaka.ng" -I` → includes `Access-Control-Allow-Origin` (CORS not broken)
3. Run an online security header scanner (securityheaders.com) against the staging URL → A grade minimum

**Risk if skipped:** Browser-based API clients are vulnerable to clickjacking, MIME-type sniffing attacks, and information leakage via `Referer` headers; fails basic security audit by any enterprise partner.

---

### Task 2.3: Fix Hardcoded `app.webwaka.com` Callback URL in Payments Route

**Priority:** HIGH (H-04)
**Est:** 30m
**Files:**
- `apps/api/src/routes/payments.ts`
- `apps/api/wrangler.toml` (`[vars]` block — add `APP_BASE_URL`)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] `callbackUrl` uses `c.env.APP_BASE_URL` — never a hardcoded domain string
- [ ] `APP_BASE_URL` is defined in `[vars]` for development (`http://localhost:8787`), staging (`https://app.webwaka-staging.ng`), and production (`https://app.webwaka.ng`)
- [ ] No occurrences of `app.webwaka.com` (old domain, non-HTTPS variant) remain in any route file
- [ ] The `{PAYSTACK_REFERENCE}` placeholder in the callback URL template is replaced with the actual variable interpolation `${ref}`
- [ ] Staging Paystack test transaction completes and redirects to the correct staging callback URL

**Implementation Steps:**
1. Open `apps/api/src/routes/payments.ts` and find the hardcoded `callbackUrl` string
2. Replace with: `` callbackUrl: `${c.env.APP_BASE_URL}/billing/verify?ref=${ref}` ``
3. Add `APP_BASE_URL` to each environment block in `apps/api/wrangler.toml`:
   - `[vars]`: `APP_BASE_URL = "http://localhost:8787"`
   - `[env.staging.vars]`: `APP_BASE_URL = "https://app.webwaka-staging.ng"`
   - `[env.production.vars]`: `APP_BASE_URL = "https://app.webwaka.ng"`
4. Search for `app.webwaka.com` across all files: `grep -r "app.webwaka.com" --include="*.ts" .` — fix any other occurrences found
5. Run tsc to confirm no type errors introduced

**QA Verification:**
1. `grep -r "app.webwaka.com" --include="*.ts" .` → zero results
2. `grep -r "APP_BASE_URL" apps/api/wrangler.toml` → present in all 3 environment blocks
3. Initiate a test payment in staging → Paystack redirect goes to `https://app.webwaka-staging.ng/billing/verify?ref=<ref>` (not `app.webwaka.com`)

**Risk if skipped:** Every Paystack checkout in staging and production redirects back to a non-existent URL; all payment flows are broken; no workspace upgrades complete.

---

### Task 2.4: Implement Smoke Test Suite in `tests/smoke/`

**Priority:** HIGH (H-06)
**Est:** 1d
**Files:**
- `tests/smoke/package.json` (CREATE)
- `tests/smoke/health.test.ts` (CREATE)
- `tests/smoke/auth.test.ts` (CREATE)
- `tests/smoke/geography.test.ts` (CREATE)
- `tests/smoke/discovery.test.ts` (CREATE)
- `.github/workflows/deploy-staging.yml` (enable smoke test step)
**Dependencies:** [1.3, 1.4]

**Acceptance Criteria:**
- [ ] `tests/smoke/package.json` exists — `deploy-staging.yml` smoke test step no longer silently skips
- [ ] Smoke tests run against the staging Worker URL (`SMOKE_TARGET_URL` env var)
- [ ] `GET /health` → `{ ok: true }` test passes
- [ ] `POST /api/v1/auth/login` with invalid creds → `{ ok: false, error: { code: "INVALID_CREDENTIALS" } }` test passes
- [ ] `GET /api/v1/geography/places?stateId=lagos` → returns array with at least one LGA test passes
- [ ] `GET /api/v1/discover?q=shop` → returns paginated listing results test passes
- [ ] All smoke tests complete within 30 seconds total
- [ ] A smoke test failure causes the GitHub Actions job to exit non-zero and notifies via workflow annotations

**Implementation Steps:**
1. Create `tests/smoke/package.json` with `{ "name": "@webwaka/smoke-tests", "scripts": { "test": "tsx --test smoke/*.test.ts" }, "dependencies": {} }`
2. Write `health.test.ts`: fetch `${SMOKE_TARGET_URL}/health`, assert `ok === true`
3. Write `auth.test.ts`: POST to `/api/v1/auth/login` with `{ phone: "invalid", otp: "000000" }`, assert 401 + error code
4. Write `geography.test.ts`: GET `/api/v1/geography/places?stateId=lagos`, assert array length > 0
5. Write `discovery.test.ts`: GET `/discover?q=shop`, assert `{ ok: true, data: { results: [...] } }`
6. In `deploy-staging.yml`: add smoke test step after deploy:
   ```yaml
   - name: Run smoke tests
     run: pnpm --filter @webwaka/smoke-tests test
     env:
       SMOKE_TARGET_URL: https://webwaka-api-staging.workers.dev
   ```
7. Run smoke tests once manually against staging URL

**QA Verification:**
1. `SMOKE_TARGET_URL=https://webwaka-api-staging.workers.dev pnpm --filter @webwaka/smoke-tests test` → all tests pass in < 30s
2. Temporarily break the health endpoint, push to staging → smoke test step fails, GitHub Actions job marked red
3. GitHub Actions workflow log shows individual test names and pass/fail status

**Risk if skipped:** Broken staging deployments go undetected until a human notices; the CI/CD pipeline provides false confidence after every deploy.

---

### Task 2.5: Wire Error Monitoring — Structured Logging + Alerting

**Priority:** HIGH (H-07)
**Est:** 1d
**Files:**
- `apps/api/src/index.ts`
- `apps/api/src/lib/logger.ts` (CREATE)
- `apps/api/wrangler.toml` (add `LOG_ENDPOINT` var and `SENTRY_DSN` secret comment)
- All other app `index.ts` files (replicate pattern)
**Dependencies:** [1.10]

**Acceptance Criteria:**
- [ ] A structured `logger` module emits JSON log lines: `{ level, worker, tenantId, requestId, message, error?, durationMs }`
- [ ] `app.onError` in all 8 apps calls `logger.error(err)` with request context
- [ ] In production: errors are forwarded to an external log sink (Axiom or Better Stack) via `fetch` to `LOG_ENDPOINT`
- [ ] In development/staging: errors go to `console.error` only (not forwarded)
- [ ] Every incoming request gets a `X-Request-Id` header; the request ID is propagated to all log lines within that request
- [ ] `console.error` calls in route handlers are replaced by `logger.error` calls
- [ ] Worker CPU time per request is logged at the `info` level for requests > 50ms
- [ ] A Cloudflare Workers Logpush job (or equivalent) is documented in `docs/infra/observability.md` (CREATE)

**Implementation Steps:**
1. Create `apps/api/src/lib/logger.ts` with a `createLogger(ctx: { tenantId?, requestId, worker: string })` factory
2. The logger's `error(msg, err?)` method: in development logs to `console.error`, in production additionally `fetch`es to `c.env.LOG_ENDPOINT` (if set) with a JSON body
3. In `apps/api/src/index.ts`, add `app.use('/*', requestIdMiddleware)` that generates and attaches a UUID `requestId`
4. Replace `app.onError` console.error with `logger.error`
5. Add `LOG_ENDPOINT` to `[vars]` (empty in dev, set in staging/production environments)
6. Document Cloudflare Logpush setup steps in `docs/infra/observability.md`
7. Replicate the logger pattern in `apps/brand-runtime`, `apps/public-discovery`, `apps/ussd-gateway`, `apps/projections`

**QA Verification:**
1. Trigger a deliberate 500 error (call a non-existent endpoint) → Worker logs show structured JSON: `{ "level":"error", "worker":"webwaka-api", "requestId":"<uuid>", "message":"Not found" }`
2. Set `LOG_ENDPOINT` to a request-bin URL in staging → confirm error payloads arrive within 2 seconds
3. `curl -I https://webwaka-api-staging.workers.dev/health` → response includes `X-Request-Id: <uuid>` header

**Risk if skipped:** Production errors are silently swallowed; the team has no visibility into failure rates, error types, or which tenants are experiencing issues; SLA guarantees are impossible.

---

### Task 2.6: Create Root `README.md`

**Priority:** HIGH (H-02)
**Est:** 2h
**Files:**
- `README.md` (CREATE)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] File exists at repo root
- [ ] Sections: Project Description, Architecture Overview, Tech Stack, Prerequisites, Local Setup, Running Tests, Deploying to Staging, Deploying to Production, Environment Variables Reference, Contributing, Licence
- [ ] Local setup steps are accurate — a new developer can follow them end-to-end without external guidance
- [ ] All required environment variables (secrets) are listed by name with descriptions (values redacted)
- [ ] Links to `docs/governance/`, `docs/architecture/decisions/`, and `CONTRIBUTING.md`
- [ ] Platform invariants (P9, T3, P14) are summarised in the README
- [ ] GitHub Actions badge included showing CI status

**Implementation Steps:**
1. Write each section based on the existing governance docs and `replit.md`
2. Verify local setup steps by following them in a fresh shell
3. Cross-reference `docs/governance/platform-invariants.md` for invariant list
4. Add badge: `[![CI](https://github.com/WebWakaDOS/webwaka-os/actions/workflows/ci.yml/badge.svg)](https://github.com/WebWakaDOS/webwaka-os/actions/workflows/ci.yml)`

**QA Verification:**
1. `ls README.md` → file exists
2. Follow the "Local Setup" steps verbatim in a new terminal → `pnpm dev` starts without errors
3. A new team member (or agent) can deploy to staging by reading only the README — no tribal knowledge required

**Risk if skipped:** New contributors (engineers, agents) have no entry point; onboarding time is weeks instead of hours; the project appears abandoned to external evaluators.

---

### Task 2.7: Generate Minimal OpenAPI 3.1 Specification for Core Platform Routes

**Priority:** HIGH (H-03)
**Est:** 2d
**Files:**
- `docs/api/openapi.yaml` (CREATE)
- `apps/api/src/routes/openapi.ts` (CREATE — serve spec at `/api/v1/docs`)
**Dependencies:** [1.10]

**Acceptance Criteria:**
- [ ] OpenAPI 3.1 YAML file documents all 14 core platform route groups (auth, geography, claims, identity, workspaces, payments, commerce, community, social, negotiation, pos, ussd, governance, discovery)
- [ ] Each documented endpoint has: summary, description, request body schema, response schemas for 200 and 4xx, security requirements
- [ ] `GET /api/v1/docs` serves the spec as JSON (Hono route)
- [ ] `GET /api/v1/docs/ui` serves a Swagger UI HTML page
- [ ] All money fields in the spec are documented as `type: integer` with `description: "Amount in kobo (integer, no decimals)"`
- [ ] Spec validates cleanly with `swagger-cli validate docs/api/openapi.yaml`

**Implementation Steps:**
1. Create `docs/api/openapi.yaml` starting with the info block, servers, and security scheme (Bearer JWT)
2. Document each of the 14 route groups in order: pull endpoint paths, HTTP methods, and response shapes directly from route files
3. Add `components/schemas` for: `ApiResponse`, `AuthContext`, `Workspace`, `Claim`, `NegotiationSession`, `PriceLock`, `PaystackCheckout`
4. Add `components/securitySchemes`: `BearerAuth` (HTTP, bearer)
5. Create `apps/api/src/routes/openapi.ts` that serves the YAML as JSON and renders Swagger UI (use `hono/swagger-ui`)
6. Register the route in `apps/api/src/index.ts` without auth middleware (public spec)
7. Run `swagger-cli validate docs/api/openapi.yaml`

**QA Verification:**
1. `curl https://webwaka-api-staging.workers.dev/api/v1/docs` → returns valid OpenAPI JSON with `openapi: "3.1.0"` at top level
2. `GET /api/v1/docs/ui` in browser → Swagger UI renders with all 14 route groups listed
3. `swagger-cli validate docs/api/openapi.yaml` → exits 0 with "Swagger document is valid"

**Risk if skipped:** No frontend team, mobile app developer, or integration partner can consume the API; development of Pillar 2 and Pillar 3 frontends cannot proceed in parallel.

---

### Task 2.8: Implement Real Analytics Rebuild in `apps/projections`

**Priority:** HIGH (H-08)
**Est:** 2d
**Files:**
- `apps/projections/src/index.ts`
- `apps/projections/src/analytics.ts` (CREATE)
- `infra/db/migrations/0186_analytics_snapshots.sql` (CREATE)
**Dependencies:** [1.4]

**Acceptance Criteria:**
- [ ] Migration 0186 creates an `analytics_snapshots` table: `(id, tenant_id, snapshot_date, active_workspaces, total_claims, total_orders_kobo, total_sessions, created_at)`
- [ ] `POST /rebuild/analytics` runs actual SQL aggregations from `event_log` and `workspaces` tables into `analytics_snapshots`
- [ ] `GET /analytics/snapshot?tenantId=<id>&date=<YYYY-MM-DD>` returns the latest snapshot for the tenant
- [ ] The stub response string `'Analytics rebuild queued (stub...'` is removed
- [ ] All money aggregations use `SUM(amount_kobo)` — integer arithmetic only (P9)
- [ ] Rebuild completes within 10 seconds for a tenant with 10,000 events (or is implemented as a paginated batch job)
- [ ] Migration 0186 follows naming convention and is added to the migrations index

**Implementation Steps:**
1. Write `infra/db/migrations/0186_analytics_snapshots.sql` with `CREATE TABLE IF NOT EXISTS analytics_snapshots`
2. Create `apps/projections/src/analytics.ts` with `rebuildAnalyticsSnapshot(db, tenantId, date)` function
3. The function runs: `SELECT COUNT(*) FROM workspaces WHERE tenant_id=? AND status='active'`, `SELECT SUM(total_kobo) FROM orders WHERE tenant_id=? AND DATE(created_at)=?`, etc.
4. Upserts the result into `analytics_snapshots`
5. Update `apps/projections/src/index.ts` `POST /rebuild/analytics` handler to call `rebuildAnalyticsSnapshot`
6. Add `GET /analytics/snapshot` endpoint
7. Apply migration 0186 to staging after implementation

**QA Verification:**
1. `curl -X POST https://webwaka-projections-staging.workers.dev/rebuild/analytics -H "X-Tenant-Id: test_tenant"` → `{ "ok": true, "data": { "snapshotDate": "2026-04-10", "activeWorkspaces": <N> } }` (not stub message)
2. `wrangler d1 execute webwaka-staging --command "SELECT * FROM analytics_snapshots LIMIT 1" --remote` → returns a row with non-null `total_claims`
3. `curl -X POST .../rebuild/analytics` called twice in succession → second call is idempotent (upserts, no duplicate rows)

**Risk if skipped:** Platform has no usage metrics; product decisions, billing audits, and investor reporting are all impossible; analytics stay permanently stubbed.

---

### Task 2.9: Partner Admin Portal — Scaffold and Core Tenant Management

**Priority:** HIGH (H-09)
**Est:** 10d
**Files:**
- `apps/partner-admin/src/index.ts` (CREATE)
- `apps/partner-admin/src/routes/tenants.ts` (CREATE)
- `apps/partner-admin/src/routes/workspaces.ts` (CREATE)
- `apps/partner-admin/src/routes/billing.ts` (CREATE)
- `apps/partner-admin/src/middleware/auth.ts` (CREATE)
- `apps/partner-admin/wrangler.toml` (CREATE or COMPLETE)
**Dependencies:** [1.10, 2.5]

**Acceptance Criteria:**
- [ ] `apps/partner-admin` is a Hono Cloudflare Worker (not Node.js) consistent with the rest of the platform
- [ ] `GET /health` returns `{ ok: true, worker: "partner-admin" }`
- [ ] Partners authenticate via the same JWT system as the main API (shared `authMiddleware`)
- [ ] `GET /admin/tenants` — lists all tenants for the authenticated partner (filtered by `partner_id`)
- [ ] `GET /admin/tenants/:tenantId/workspaces` — lists all workspaces for a tenant
- [ ] `GET /admin/billing/subscriptions` — lists all active subscription records with Paystack references
- [ ] `POST /admin/tenants/:tenantId/suspend` — sets tenant `status = 'suspended'` with L3 HITL gate (requires `reason` field)
- [ ] All routes enforce `partner_id` scoping — a partner cannot see another partner's tenants
- [ ] `wrangler.toml` configured with D1 binding (same database as main API)

**Implementation Steps:**
1. Create `apps/partner-admin/wrangler.toml` following the same pattern as `apps/api/wrangler.toml`
2. Create `apps/partner-admin/src/index.ts` with Hono app, `secureHeaders`, CORS, auth middleware, and route registrations
3. Implement `routes/tenants.ts`, `routes/workspaces.ts`, `routes/billing.ts` with D1 queries scoped by `partner_id`
4. Implement `partner_id` extraction from the JWT `Variables` context (add `partnerId` to `AuthContext` type in `apps/api/src/types.ts`)
5. Add `L3HitlGate` check to the suspend route
6. Write integration tests for each route with mocked D1

**QA Verification:**
1. `curl https://webwaka-partner-admin-staging.workers.dev/health` → `{ "ok": true, "worker": "partner-admin" }`
2. `curl https://webwaka-partner-admin-staging.workers.dev/admin/tenants -H "Authorization: Bearer <partner_jwt>"` → returns only tenants belonging to that partner (not all tenants)
3. Attempt to access another partner's tenant: `curl .../admin/tenants/<other_partner_tenant_id>/workspaces -H "Authorization: Bearer <partner_jwt>"` → `403 Forbidden`

**Risk if skipped:** Partners have no self-service management capability; the platform operations team must manually handle every tenant configuration change via raw D1 queries; the product cannot scale past a handful of managed clients.

---

### Task 2.10: Commission DTIA for Telegram and Meta API (Cross-Border Data Transfer)

**Priority:** HIGH (H-10) — External Dependency
**Est:** 2–4 weeks (external legal/compliance work)
**Files:**
- `docs/compliance/dtia-telegram.md` (CREATE — brief + findings)
- `docs/compliance/dtia-meta.md` (CREATE)
- `docs/qa/ndpr-consent-audit.md` (UPDATE — mark DTIA items as resolved)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] A NITDA-accredited Data Protection Compliance Organisation (DPCO) is engaged
- [ ] DTIA completed for Telegram (data processed in Netherlands, Telegram NL BV)
- [ ] DTIA completed for Meta (WhatsApp Business API, data processed in USA)
- [ ] Both DTIAs conclude with either: (a) adequate protection exists and transfer is permitted, or (b) supplementary measures identified and implemented
- [ ] `docs/compliance/dtia-telegram.md` contains: data categories transferred, transfer mechanism, adequacy assessment, residual risk rating, DPO sign-off
- [ ] Same structure for `docs/compliance/dtia-meta.md`
- [ ] `ndpr-consent-audit.md` updated — both DTIA items marked `DONE`
- [ ] If DTIA reveals a blocking finding, the Telegram/Meta integration is suspended until remediation is complete

**Implementation Steps:**
1. Draft a data mapping for both integrations: what personal data is sent, who processes it, legal basis, retention
2. Engage DPCO — share the data mapping for DTIA
3. If DTIA finds a blocking issue: disable the Telegram OTP channel and Meta WhatsApp channel until remediated
4. Document findings in `docs/compliance/`
5. Update the NDPR consent audit log

**QA Verification:**
1. Both DTIA documents exist in `docs/compliance/` with DPO sign-off date
2. `grep -n "PARTIAL" docs/qa/ndpr-consent-audit.md` → returns zero lines for DTIA items
3. DTIA docs are reviewed and accepted by a NITDA-accredited DPCO (external sign-off required)

**Risk if skipped:** Sending Nigerian users' phone numbers and message content to Telegram (Netherlands) and Meta (USA) without a DTIA is a direct NDPR Article 2.10 violation; NITDA can impose fines and require service suspension.

---

## PHASE 3: MEDIUM PRIORITY (Week 5–7)

**Risk:** Scalability bottlenecks, regulatory non-compliance at scale, user data loss, 10k user ceiling
**Est Total:** ~30 dev-days (excluding external regulatory processes)

---

### Task 3.1: Implement R2 File Upload Routes — Profile Images, KYC Documents, Product Photos

**Priority:** MEDIUM (M-06)
**Est:** 3d
**Files:**
- `apps/api/src/routes/uploads.ts` (CREATE)
- `packages/storage/src/r2.ts` (CREATE or COMPLETE)
- `apps/api/src/index.ts` (register uploads router)
- `apps/api/wrangler.toml` (add `ASSETS_BUCKET` R2 binding)
**Dependencies:** [1.10, 2.5]

**Acceptance Criteria:**
- [ ] `POST /api/v1/uploads/profile-image` — accepts multipart `image/*` up to 5 MB; stores in R2 at `tenantId/profiles/userId/avatar.<ext>`; returns signed `{ url }` valid for 1 hour
- [ ] `POST /api/v1/uploads/kyc-document` — accepts PDF/JPEG up to 10 MB; stores at `tenantId/kyc/userId/<type>.<ext>`; returns signed URL
- [ ] `POST /api/v1/uploads/product-photo` — accepts `image/*` up to 5 MB per photo, max 10 photos; stores at `tenantId/products/productId/<n>.<ext>`
- [ ] All uploads validate MIME type server-side (Content-Type header alone is not trusted — check magic bytes)
- [ ] All uploads are scoped to `tenantId` (T3 invariant) — no cross-tenant file access
- [ ] Signed URLs use Cloudflare R2 presigned URL mechanism with 1-hour expiry
- [ ] Files larger than their limits return `413 Payload Too Large`
- [ ] No personally identifiable filenames — UUID-based storage keys only

**Implementation Steps:**
1. Add `[[r2_buckets]]` binding to `apps/api/wrangler.toml` for staging (`assets-staging`) and production (`assets-production`)
2. Create `packages/storage/src/r2.ts` with `uploadFile(bucket, key, body, contentType)` and `getSignedUrl(bucket, key, expirySeconds)` helpers
3. Create `apps/api/src/routes/uploads.ts` with the 3 upload routes
4. In each route: extract `tenantId` from auth context, generate UUID key, validate MIME, upload to R2, return signed URL
5. Add magic byte validation: check first 4 bytes of the upload body against known image/PDF signatures
6. Register router: `app.route('/api/v1/uploads', uploadsRouter)` in `index.ts`

**QA Verification:**
1. `curl -X POST https://webwaka-api-staging.workers.dev/api/v1/uploads/profile-image -H "Authorization: Bearer <jwt>" -F "file=@avatar.jpg"` → `{ "ok": true, "data": { "url": "https://..." } }`
2. Upload a 6 MB file → `413 Payload Too Large`
3. Upload a `.html` file renamed as `.jpg` → `{ "ok": false, "error": { "code": "INVALID_FILE_TYPE" } }` (magic byte check triggered)

**Risk if skipped:** KYC T2/T3 cannot be implemented without document upload; product listings lack images; profile pages are text-only; platform cannot compete with WhatsApp Business listings.

---

### Task 3.2: Implement KYC Tier 2 — BVN/NIN Linkage with Transaction Limit Upgrade

**Priority:** MEDIUM (M-01, part 1)
**Est:** 1w
**Files:**
- `apps/api/src/routes/identity.ts` (MODIFY — add T2 upgrade flow)
- `packages/identity/src/tier2.ts` (CREATE)
- `packages/identity/src/types.ts` (MODIFY — add T2 types)
- `infra/db/migrations/0187_kyc_tier2.sql` (CREATE)
**Dependencies:** [3.1, 1.10]

**Acceptance Criteria:**
- [ ] Migration 0187 adds `kyc_tier2_verified_at`, `bvn_hash`, `nin_hash` columns to `users` table
- [ ] `POST /api/v1/identity/upgrade-tier2` accepts `{ bvn?, nin? }`, verifies with Prembly, on success sets `kyc_tier = 2`
- [ ] BVN and NIN values are **never stored raw** — only SHA-256 hashed with `KYC_PII_SALT` Worker Secret
- [ ] After T2 upgrade: `assertWithinTierLimits` allows ₦2,000,000/day (T2 limit per CBN KYC guidelines)
- [ ] Rate limited: max 3 T2 upgrade attempts per user per 24 hours
- [ ] Prembly API call timeout is 10 seconds; if Prembly is unavailable → `503` with retry guidance
- [ ] If Prembly returns a mismatch → `422` with `code: "KYC_MISMATCH"` (no detail about which field mismatched — prevents enumeration)

**Implementation Steps:**
1. Write migration 0187
2. Create `packages/identity/src/tier2.ts` with `verifyBvnNin(premblyKey, bvn, nin)` function
3. In the identity route: add `POST /identity/upgrade-tier2` — validate input, call Prembly, on success hash and store, update `kyc_tier = 2`
4. Update `assertWithinTierLimits` to allow ₦2,000,000/day for `kyc_tier >= 2`
5. Add the 3-attempt-per-day rate limit using `RATE_LIMIT_KV`
6. Apply migration 0187 to staging

**QA Verification:**
1. `curl -X POST .../identity/upgrade-tier2 -d '{"bvn":"22212345678"}' -H "Authorization: Bearer <jwt>"` with valid Prembly test BVN → `{ "ok": true, "data": { "tier": 2 } }`
2. Attempt 4 upgrades within 24 hours → 4th attempt returns `429` with `code: "KYC_RATE_LIMIT"`
3. `wrangler d1 execute webwaka-staging --command "SELECT bvn_hash FROM users WHERE id='<test_user>'" --remote` → value is a SHA-256 hash, not raw BVN

**Risk if skipped:** All users are capped at ₦200,000/day transaction limit; high-value commerce verticals (used-car, building-materials, export) are unusable; platform cannot serve business customers.

---

### Task 3.3: Implement KYC Tier 3 — Document Upload + Manual Review Queue

**Priority:** MEDIUM (M-01, part 2)
**Est:** 1w
**Files:**
- `apps/api/src/routes/identity.ts` (MODIFY — T3 upload flow)
- `packages/identity/src/tier3.ts` (CREATE)
- `infra/db/migrations/0188_kyc_tier3.sql` (CREATE)
- `apps/admin-dashboard/src/routes/kyc-review.ts` (CREATE)
**Dependencies:** [3.1, 3.2]

**Acceptance Criteria:**
- [ ] `POST /api/v1/identity/upgrade-tier3` accepts `{ documentType, fileKey }` (R2 key from prior upload)
- [ ] Tier 3 application creates a `kyc_review_queue` record in D1 with `status = 'pending'`
- [ ] Admin dashboard route `GET /admin/kyc/queue` lists pending Tier 3 applications
- [ ] Admin route `POST /admin/kyc/:reviewId/approve` sets `kyc_tier = 3` and updates limits to ₦5,000,000/day
- [ ] Admin route `POST /admin/kyc/:reviewId/reject` notifies user via their preferred channel
- [ ] Document file keys in D1 never contain PII — only the R2 key (UUID-based path)
- [ ] L3 HITL gate on the approve action — requires `reason` and a second admin's JWT for final approval if `amount > ₦5,000,000`

**Implementation Steps:**
1. Write migration 0188 creating `kyc_review_queue` table
2. Create `packages/identity/src/tier3.ts`
3. Add T3 upload route to identity router
4. Create admin dashboard KYC review routes
5. Wire T3 approval to update `kyc_tier` and `assertWithinTierLimits`
6. Apply migration 0188

**QA Verification:**
1. Submit T3 application → `kyc_review_queue` row appears with `status = 'pending'`
2. Admin approves → user's `kyc_tier` updates to 3; user can transact ₦5,000,000
3. Attempt to approve without a second admin JWT → `403` with `code: "HITL_REQUIRED"`

**Risk if skipped:** Platform cannot serve high-value enterprise and government clients who require Tier 3 KYC clearance.

---

### Task 3.4: Build AML Transaction Velocity Rule Engine

**Priority:** MEDIUM (M-02)
**Est:** 2w
**Files:**
- `packages/aml/src/index.ts` (CREATE)
- `packages/aml/src/rules.ts` (CREATE)
- `packages/aml/src/types.ts` (CREATE)
- `infra/db/migrations/0189_aml_flags.sql` (CREATE)
- `apps/api/src/middleware/aml.ts` (CREATE)
**Dependencies:** [3.2, 1.10]

**Acceptance Criteria:**
- [ ] Migration 0189 creates `aml_flags` table: `(id, tenant_id, user_id, flag_type, amount_kobo, triggered_at, resolved_at, resolution)`
- [ ] Rule 1: Single transaction > ₦5,000,000 → flag with `LARGE_TRANSACTION` (CBN STR threshold)
- [ ] Rule 2: >10 transactions within 1 hour per user → flag with `VELOCITY_BREACH`
- [ ] Rule 3: Total daily volume > ₦10,000,000 per user → flag with `DAILY_VOLUME_BREACH`
- [ ] Flagged transactions are allowed to proceed (not blocked) but are queued for review
- [ ] `GET /admin/aml/flags?status=pending` returns all open flags for compliance review
- [ ] `POST /admin/aml/flags/:id/resolve` marks a flag as reviewed with `resolution` field
- [ ] AML check is injected as middleware on all payment and commerce routes
- [ ] No AML check adds >5ms latency (async fire-and-forget if needed)

**Implementation Steps:**
1. Write migration 0189
2. Create `packages/aml/src/rules.ts` with the 3 rule functions
3. Create `packages/aml/src/index.ts` with `checkTransaction(db, tenantId, userId, amountKobo)` function
4. Create `apps/api/src/middleware/aml.ts` that calls `checkTransaction` and writes any flags to D1
5. Apply middleware to all payment, POS, and commerce routes
6. Create admin flag review routes in `apps/admin-dashboard`

**QA Verification:**
1. Submit a ₦6,000,000 payment → `aml_flags` row created with `flag_type = 'LARGE_TRANSACTION'`; payment still proceeds
2. Submit 11 transactions within 60 seconds → 11th triggers `VELOCITY_BREACH` flag
3. `GET /admin/aml/flags?status=pending` → returns at least the 2 flags from above tests

**Risk if skipped:** Direct CBN KYC/AML non-compliance; CBN audit would shut down platform's payment processing capability.

---

### Task 3.5: Submit CBN Sandbox Application (Regulatory)

**Priority:** MEDIUM (M-03) — External
**Est:** 4–12 weeks (regulatory)
**Files:**
- `docs/compliance/cbn-sandbox-application.md` (CREATE — application package)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] CBN PSSP Sandbox application filed (or Paystack umbrella licence coverage confirmed in writing)
- [ ] Application package document in `docs/compliance/cbn-sandbox-application.md`
- [ ] CBN sandbox credentials received and stored as Cloudflare Worker Secrets
- [ ] AML engine (Task 3.4) is in place before production CBN approval is sought
- [ ] A compliance counsel has reviewed the application

**Implementation Steps:**
1. Determine whether Paystack's CBN licence covers WebWaka's use case (aggregate payments as a SaaS platform) — get written confirmation from Paystack partnerships
2. If not covered: initiate direct CBN PSSP application at https://www.cbn.gov.ng/PSP
3. Document the application process and reference number in `docs/compliance/`
4. Set up CBN sandbox test credentials when received

**QA Verification:**
1. Written confirmation from Paystack OR CBN application reference number obtained
2. `docs/compliance/cbn-sandbox-application.md` exists with application date and reference
3. CBN sandbox payment test completes successfully (after credentials received)

**Risk if skipped:** All payment processing in Nigeria requires CBN licensing or coverage; operating without it is an unlicensed financial services violation punishable by fines and platform shutdown.

---

### Task 3.6: Integrate NIBSS BVN Verification as Alternative to Prembly

**Priority:** MEDIUM (M-04)
**Est:** 1w
**Files:**
- `packages/identity/src/nibss.ts` (CREATE)
- `packages/identity/src/tier2.ts` (MODIFY — add NIBSS path)
- `apps/api/wrangler.toml` (add `NIBSS_*` secret comments)
**Dependencies:** [3.2]

**Acceptance Criteria:**
- [ ] `packages/identity/src/nibss.ts` implements NIBSS BVN verification API client
- [ ] `verifyBvnNin` function in `tier2.ts` accepts a `provider: 'prembly' | 'nibss'` parameter (defaults to `prembly`)
- [ ] NIBSS is used as primary when `NIBSS_API_KEY` Worker Secret is set; Prembly as fallback
- [ ] NIBSS timeout is 15 seconds (NIBSS API is slower than Prembly)
- [ ] NIBSS API errors map to the same error codes as Prembly (no leakage of provider-specific errors to clients)
- [ ] Unit tests cover both providers with mocked responses

**Implementation Steps:**
1. Research NIBSS BVN verification API documentation (NIBSS eBanking service)
2. Create `packages/identity/src/nibss.ts` with the NIBSS HTTP client
3. Modify `tier2.ts` to check for `NIBSS_API_KEY` and route accordingly
4. Add mock responses in unit tests for both providers

**QA Verification:**
1. Set `NIBSS_API_KEY` in staging Worker Secrets → BVN verification routes through NIBSS (verify via log output)
2. Remove `NIBSS_API_KEY` → verification falls back to Prembly (verify via log output)
3. NIBSS unreachable → fallback to Prembly in < 2 seconds

**Risk if skipped:** CBN prefers NIBSS for KYC verification; dependence on Prembly alone creates a single-point-of-failure and potential CBN compliance issue.

---

### Task 3.7: Publish Privacy Policy v2 (NDPR Compliance)

**Priority:** MEDIUM (M-05) — External/Legal
**Est:** 1w
**Files:**
- `docs/compliance/privacy-policy-v2.md` (CREATE — draft for legal review)
- `apps/brand-runtime/src/routes/legal.ts` (CREATE — serve policy at `/legal/privacy`)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] Privacy Policy v2 is publicly accessible at `https://webwaka.ng/legal/privacy`
- [ ] Policy covers: data collected, purposes, legal basis (NDPR Articles 2.2–2.4), retention periods, rights (access, rectification, erasure), cross-border transfers, contact details of DPO
- [ ] A legal counsel has reviewed and approved the policy
- [ ] The policy URL is referenced in all consent collection flows (OTP consent, channel consent)
- [ ] The policy is available in English and Hausa (Nigeria's two most widely spoken languages)
- [ ] Policy version is stored in D1 and linked to each consent record

**Implementation Steps:**
1. Draft `docs/compliance/privacy-policy-v2.md` based on NDPR requirements
2. Submit for legal review
3. Create `apps/brand-runtime/src/routes/legal.ts` serving the policy as HTML
4. Update all consent collection flows to link to the policy URL

**QA Verification:**
1. `curl https://webwaka.ng/legal/privacy` → returns HTML page with Privacy Policy content
2. Consent collection OTP screen includes a link to the Privacy Policy URL
3. Legal counsel sign-off date is recorded in `docs/compliance/privacy-policy-v2.md`

**Risk if skipped:** Collecting personal data without a published Privacy Policy is a direct NDPR violation; NITDA can issue enforcement notices that force service suspension.

---

### Task 3.8: Implement Consent Withdrawal Telegram Data Deletion Webhook

**Priority:** MEDIUM (M-08)
**Est:** 1d
**Files:**
- `packages/contact/src/telegram-gdpr.ts` (CREATE)
- `apps/api/src/routes/contact.ts` (MODIFY — add channel removal handler)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] When a user removes their Telegram channel (`DELETE /api/v1/contact/channels/telegram`): the system calls Telegram's `deleteMessage` API to delete all platform-sent messages within the last 48 hours
- [ ] The user's Telegram `chat_id` is deleted from D1 after message deletion
- [ ] `channel_consent` record is set to `withdrawn_at = NOW()`
- [ ] Telegram API call failure does not block the channel removal (fire-and-forget with error logging)
- [ ] Unit test covers: successful deletion, Telegram API unavailable (proceeds anyway), messages older than 48 hours (skipped, logged)

**Implementation Steps:**
1. Create `packages/contact/src/telegram-gdpr.ts` with `deleteUserTelegramMessages(chatId, botToken, messageIds[])` function
2. In the contact route channel removal handler: call the deletion function after updating D1
3. Store recent Telegram `message_id`s in D1 (or KV with TTL) to enable deletion — if not currently stored, log a warning and proceed
4. Write unit test

**QA Verification:**
1. Remove Telegram channel via API → Telegram bot sends no further messages to that chat_id
2. Check D1: `chat_id` null, `channel_consent.withdrawn_at` set
3. Remove Telegram channel when Telegram API is unreachable → channel still removed from D1; error logged

**Risk if skipped:** NDPR right-to-erasure (Article 3.1(5)) is violated; NITDA enforcement action possible; users cannot fully remove their data from Telegram's servers.

---

### Task 3.9: Remove Community and Social Stub Files

**Priority:** MEDIUM (M-07)
**Est:** 2h
**Files:**
- `packages/community/src/stub.ts` (DELETE)
- `packages/social/src/stub.ts` (DELETE)
- `packages/community/src/index.ts` (VERIFY — no stub imports)
- `packages/social/src/index.ts` (VERIFY — no stub imports)
**Dependencies:** []

**Acceptance Criteria:**
- [ ] `packages/community/src/stub.ts` deleted
- [ ] `packages/social/src/stub.ts` deleted
- [ ] No file anywhere imports from these stub files
- [ ] `pnpm typecheck` still passes after deletion
- [ ] `COMMUNITY_STUB_VERSION` and `SOCIAL_STUB_VERSION` constants are not referenced anywhere in production code

**Implementation Steps:**
1. `grep -r "stub.ts\|COMMUNITY_STUB_VERSION\|SOCIAL_STUB_VERSION" --include="*.ts" .` to find all references
2. For each reference: trace whether it's used in production code or tests
3. Remove the stub files
4. Run `pnpm typecheck` to confirm no breakage
5. Commit with `refactor: remove community and social stub files`

**QA Verification:**
1. `ls packages/community/src/stub.ts` → "No such file"
2. `ls packages/social/src/stub.ts` → "No such file"
3. `pnpm typecheck` → exits 0

**Risk if skipped:** Stub constants pollute the package exports, causing confusion about implementation completeness; future agents or developers may build on stub interfaces instead of real implementations.

---

### Task 3.10: Load Testing — Baseline Performance at 1,000 Concurrent Users

**Priority:** MEDIUM (M-09)
**Est:** 2d
**Files:**
- `tests/load/k6/discovery-search.js` (CREATE)
- `tests/load/k6/claim-flow.js` (CREATE)
- `tests/load/k6/commerce-order.js` (CREATE)
- `docs/infra/load-test-results-2026-04.md` (CREATE)
**Dependencies:** [2.1, 1.10]

**Acceptance Criteria:**
- [ ] `k6` load test for `/discover?q=shop` with 1,000 virtual users over 60 seconds
- [ ] p95 response time < 2 seconds for discovery search under 1,000 VU load
- [ ] p99 response time < 5 seconds for discovery search
- [ ] Error rate < 0.1% under 1,000 VU load (excluding expected 429s from rate limiter)
- [ ] D1 write throughput tested: `POST /api/v1/claims` at 50 concurrent writes/second — no deadlock or timeout errors
- [ ] Load test results documented in `docs/infra/load-test-results-2026-04.md` with recommendations
- [ ] Any endpoint that fails the p95 < 2s target has a filed GitHub Issue with a capacity plan

**Implementation Steps:**
1. Install `k6` locally
2. Write `discovery-search.js`: ramp from 0 to 1,000 VUs over 30s, hold for 60s
3. Write `claim-flow.js`: test concurrent claim creation with unique phone numbers
4. Run against staging Worker URL
5. Collect p50, p95, p99 metrics; document D1 write throughput findings
6. Identify bottlenecks (D1 write lock contention is expected — document mitigation)

**QA Verification:**
1. `k6 run tests/load/k6/discovery-search.js` → summary shows p95 < 2000ms, error rate < 0.1%
2. D1 concurrent write test shows no timeout errors at 50 writes/second
3. Results document exists with baseline metrics

**Risk if skipped:** Platform launches without knowing its capacity limits; first traffic spike (viral moment, press coverage) crashes the platform; no data to guide D1 read replica decision.

---

### Task 3.11: Document and Test D1 Backup / Restore Procedure

**Priority:** MEDIUM (M-10)
**Est:** 1d
**Files:**
- `docs/infra/backup-restore-runbook.md` (CREATE)
**Dependencies:** [1.4]

**Acceptance Criteria:**
- [ ] Cloudflare D1 backup schedule documented (Cloudflare manages automatic daily backups)
- [ ] Manual export procedure documented: `wrangler d1 export <database_name> --output backup.sql`
- [ ] Restore procedure documented: `wrangler d1 execute <database_name> --file backup.sql`
- [ ] A restore drill performed: export staging D1 → delete a test table → restore from export → verify table is present
- [ ] RTO (Recovery Time Objective) and RPO (Recovery Point Objective) documented based on Cloudflare's D1 backup guarantees
- [ ] Runbook includes: who to contact, Cloudflare status page URL, escalation path

**Implementation Steps:**
1. Create `docs/infra/backup-restore-runbook.md` with all sections above
2. Perform the restore drill on the staging D1 database
3. Document the actual time taken for the restore drill (RTO)
4. Cross-reference with Cloudflare D1 SLA documentation

**QA Verification:**
1. `wrangler d1 export webwaka-staging --output /tmp/backup.sql --remote` → file created > 0 bytes
2. `wrangler d1 execute webwaka-staging --file /tmp/backup.sql --remote` → all tables restored
3. `wrangler d1 execute webwaka-staging --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table'" --remote` → same count as before the delete test

**Risk if skipped:** A D1 database corruption or accidental migration failure has no documented recovery path; data loss becomes permanent rather than recoverable in minutes.

---

### Task 3.12: Document D1 Read Strategy — Caching and HA for 10k Users

**Priority:** MEDIUM (M-11)
**Est:** 1w
**Files:**
- `docs/architecture/d1-read-strategy.md` (CREATE)
- `packages/cache/src/index.ts` (CREATE or EXTEND — KV-backed read cache)
- `apps/api/src/lib/cached-db.ts` (CREATE)
**Dependencies:** [3.10]

**Acceptance Criteria:**
- [ ] Architecture document explains D1's single-writer constraint and its implications for write throughput
- [ ] A KV-backed read cache (`GEOGRAPHY_CACHE`) is implemented for frequently-read, rarely-changed data: geography tables, vertical configs, plan pricing
- [ ] Cache invalidation strategy documented: TTL-based (5 minutes for geography, 1 minute for pricing)
- [ ] Cache hit rate metric logged per request (for observability)
- [ ] `packages/cache/src/index.ts` exports `getCached(kv, key, ttlSecs, fetchFn)` — a stale-while-revalidate helper
- [ ] Load test confirms p95 < 500ms for geography and discovery endpoints when 90% of requests are cache hits

**Implementation Steps:**
1. Write `docs/architecture/d1-read-strategy.md` covering: D1 constraints, KV caching plan, CDN caching for public endpoints, Durable Objects consideration for future
2. Create `packages/cache/src/index.ts` with `getCached` function
3. Apply caching to: `GET /api/v1/geography/places`, `GET /api/v1/geography/states`, `GET /api/v1/discover`
4. Run load test with caching enabled; compare p95 to baseline

**QA Verification:**
1. `curl https://webwaka-api-staging.workers.dev/api/v1/geography/places` twice → second response includes `X-Cache: HIT` header
2. Load test with caching: p95 < 500ms for geography endpoints at 1,000 VU (vs < 2000ms without cache)
3. Invalidate cache (TTL expires or manual flush) → next request re-fetches from D1 and re-populates cache

**Risk if skipped:** D1 read throughput becomes the bottleneck at ~500 concurrent users; geography and discovery endpoints degrade to 5+ second response times under modest load.

---

### Task 3.13: Commerce Vertical — Wire Fulfilment State Machine and Dispute Resolution

**Priority:** MEDIUM (Vertical gap — Commerce)
**Est:** 1w
**Files:**
- `packages/verticals-used-car/src/fulfilment.ts` (CREATE)
- `packages/verticals-bookshop/src/fulfilment.ts` (CREATE)
- `apps/api/src/routes/verticals/used-car.ts` (MODIFY — add fulfilment endpoints)
- `apps/api/src/routes/verticals/bookshop.ts` (MODIFY)
- `infra/db/migrations/0190_order_fulfilment.sql` (CREATE)
**Dependencies:** [3.1, 1.10]

**Acceptance Criteria:**
- [ ] Order fulfilment state machine: `placed → confirmed → in_progress → completed | cancelled | disputed`
- [ ] `POST /api/v1/verticals/used-car/orders/:id/confirm` — seller confirms order
- [ ] `POST /api/v1/verticals/used-car/orders/:id/complete` — seller marks fulfilled; triggers payment release
- [ ] `POST /api/v1/verticals/used-car/orders/:id/dispute` — buyer raises dispute; order enters `disputed` state; L3 HITL gate opens
- [ ] Dispute resolution admin route: `POST /admin/disputes/:id/resolve` with `winner: 'buyer' | 'seller'` and `reason`
- [ ] Payment release only happens on `completed` state (not `confirmed`)
- [ ] All state transitions logged to `event_log` table

**Implementation Steps:**
1. Write migration 0190 adding `fulfilment_status` column with CHECK constraint on valid states
2. Create fulfilment state machine in each vertical package
3. Add endpoints to vertical route files
4. Wire dispute → HITL gate → admin resolution
5. Integrate with payment release (initially: flag for manual bank transfer, auto-release in Phase 4)

**QA Verification:**
1. Create order → confirm → complete → `fulfilment_status = 'completed'` in D1
2. Create order → dispute → `fulfilment_status = 'disputed'`; admin resolves in buyer's favour → `'refunded'`
3. Attempt to complete an order in `disputed` state → `409 Conflict`

**Risk if skipped:** Commerce verticals accept payments with no fulfilment tracking; buyers have no recourse for non-delivery; dispute resolution is impossible without the state machine.

---

### Task 3.14: Transport Vertical — Driver KYC Enforcement and NURTW Compliance Gate

**Priority:** MEDIUM (Vertical gap — Transport)
**Est:** 4d
**Files:**
- `packages/verticals-okada-keke/src/kyc-gate.ts` (CREATE)
- `packages/verticals-motor-park/src/nurtw.ts` (CREATE)
- `apps/api/src/routes/verticals/okada-keke.ts` (MODIFY)
- `apps/api/src/routes/verticals/motor-park.ts` (MODIFY)
**Dependencies:** [3.2, 1.6]

**Acceptance Criteria:**
- [ ] `POST /api/v1/verticals/okada-keke/bookings` — rejects if driver does not have `kyc_tier >= 1` AND valid `frsc_licence_hash` stored
- [ ] FRSC licence hash stored as SHA-256 of the licence number (T3 scoped) — never stored raw
- [ ] NURTW membership number validated (format check only — no API integration available) before a motor park workspace can be set to `active`
- [ ] Rejected bookings return `{ code: "DRIVER_KYC_INCOMPLETE" }` with instructions for the driver to complete KYC
- [ ] Audit log entry written to `event_log` for every KYC gate check

**Implementation Steps:**
1. Create `packages/verticals-okada-keke/src/kyc-gate.ts` with `assertDriverKycComplete(db, driverId, tenantId)`
2. Add FRSC licence number input to the okada-keke profile creation flow (optional initially, required for booking acceptance)
3. Hash and store the licence number on profile creation
4. Add the gate check to the booking creation route
5. Create NURTW format validation in motor-park package

**QA Verification:**
1. Create a booking with an unverified driver → `422` with `code: "DRIVER_KYC_INCOMPLETE"`
2. Complete driver KYC (T1 + FRSC licence) → booking succeeds
3. `event_log` table has an entry for each gate check with `event_type = 'kyc_gate_check'`

**Risk if skipped:** Unverified drivers can operate on the platform; liability risk for accidents involving unlicensed drivers; NURTW regulatory non-compliance.

---

### Task 3.15: POS Vertical — Mobile Money Agent Wallet Settlement

**Priority:** MEDIUM (Vertical gap — POS/Financial)
**Est:** 1w
**Files:**
- `packages/verticals-pos/src/settlement.ts` (CREATE)
- `apps/api/src/routes/verticals/pos.ts` (MODIFY)
- `infra/db/migrations/0191_agent_settlements.sql` (CREATE)
**Dependencies:** [3.2, 1.9]

**Acceptance Criteria:**
- [ ] Migration 0191 creates `agent_settlements` table: `(id, tenant_id, agent_id, amount_kobo, bank_code, account_number, reference, status, created_at, settled_at)`
- [ ] `POST /api/v1/verticals/pos/float/settle` — requests a settlement from agent_wallet to registered bank account via Paystack Transfer API
- [ ] All settlement amounts are integers in kobo (P9 invariant)
- [ ] Settlement requests require `kyc_tier >= 2` for the agent
- [ ] Paystack Transfer webhook updates `agent_settlements.status` to `success` or `failed`
- [ ] Failed settlements are retried once automatically after 1 hour via a Scheduled Worker cron

**Implementation Steps:**
1. Write migration 0191
2. Read Paystack Transfers API documentation and implement `packages/verticals-pos/src/settlement.ts`
3. Add settlement route to POS router
4. Add Paystack Transfer webhook handler to `apps/api/src/routes/payments.ts`
5. Add cron job to `apps/api/wrangler.toml` for settlement retry
6. Apply migration to staging

**QA Verification:**
1. Initiate settlement of ₦10,000 (1,000,000 kobo) → `agent_settlements` row with `status = 'pending'`
2. Paystack Transfer webhook `transfer.success` received → row updates to `status = 'success'`
3. Attempt settlement without KYC T2 → `403` with `code: "KYC_TIER_REQUIRED"`

**Risk if skipped:** POS agents accumulate platform wallet balances with no way to withdraw; agents abandon the platform; agent network cannot scale.

---

## PHASE 4: LONG-TERM / POLISH (Week 8–12)

**Risk:** Growth ceiling — platform cannot scale beyond early adopters without these
**Est Total:** ~40+ dev-days

---

### Task 4.1: Build User-Facing Frontend SPA — Pillar 2 (Brand Portal) + Pillar 3 (Marketplace)

**Priority:** LONG-TERM (Audit finding: no UI exists)
**Est:** 8w
**Files:**
- `apps/brand-runtime/src/` (REPLACE template strings with React SSR or static HTML with progressive enhancement)
- `apps/public-discovery/src/` (REPLACE with a proper SPA or island architecture)
- `packages/design-system/` (USE — token + component library)
**Dependencies:** [2.7, 3.1]

**Acceptance Criteria:**
- [ ] Public marketplace at `https://discover.webwaka.ng` renders entity listings with images, prices, and search
- [ ] Brand portal at `https://brand.<tenant>.webwaka.ng` renders tenant-branded public page
- [ ] All pages are mobile-responsive (320px minimum viewport width)
- [ ] All pages achieve Lighthouse score ≥ 90 for Performance, Accessibility, Best Practices, SEO
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] Pages load in < 3 seconds on a 3G connection (Nigeria mobile network baseline)
- [ ] Progressive Web App: `manifest.json`, service worker, offline fallback page
- [ ] Design system tokens used for all colors, typography, and spacing (no hardcoded values)

**Implementation Steps:**
1. Decide on rendering approach: Cloudflare Workers + React SSR (via `react-dom/server`) or static islands with Preact
2. Scaffold the marketplace SPA in `apps/public-discovery`
3. Scaffold the brand portal in `apps/brand-runtime`
4. Integrate with the OpenAPI-documented discovery and profile endpoints
5. Implement service worker and PWA manifest
6. Run Lighthouse audits and iterate until ≥ 90 on all scores

**QA Verification:**
1. Lighthouse audit on discovery page → all scores ≥ 90
2. Test on a Samsung Galaxy A15 (common Nigerian budget device) → page loads in < 3s on 3G
3. Disconnect network after page load → offline fallback page renders; no white screen of death

**Risk if skipped:** Platform is invisible to end users — there is no website, no app, no UI; zero user acquisition is possible.

---

### Task 4.2: Implement PWA (Service Worker + Manifest + Offline Fallback)

**Priority:** LONG-TERM (Referenced in governance docs, not implemented)
**Est:** 3d
**Files:**
- `apps/brand-runtime/public/manifest.json` (CREATE)
- `apps/brand-runtime/public/sw.js` (CREATE)
- `apps/public-discovery/public/manifest.json` (CREATE)
- `apps/public-discovery/public/sw.js` (CREATE)
**Dependencies:** [4.1]

**Acceptance Criteria:**
- [ ] `manifest.json` includes: name, short_name, icons (192px + 512px in WebP), theme_color (`#006B3C` Nigeria green), display: standalone, start_url
- [ ] Service worker caches: shell HTML, CSS, JS, and geography data on first visit
- [ ] Offline fallback: `/offline` page renders when network is unavailable
- [ ] "Add to Home Screen" prompt appears on Android Chrome after second visit
- [ ] App icons designed using the WebWaka brand colours from `packages/design-system`
- [ ] Lighthouse PWA score ≥ 90

**QA Verification:**
1. Android Chrome → "Add to Home Screen" prompt triggers after second visit
2. Kill network → app opens from home screen → offline fallback page renders cleanly
3. Lighthouse PWA audit → all PWA criteria pass (installable, offline support, etc.)

---

### Task 4.3: Cloudflare Logpush + Observability Dashboard

**Priority:** LONG-TERM (Extension of Task 2.5)
**Est:** 3d
**Files:**
- `docs/infra/observability.md` (CREATE — complete setup guide)
**Dependencies:** [2.5]

**Acceptance Criteria:**
- [ ] Cloudflare Workers Logpush configured to forward all Worker logs to Axiom (or Better Stack)
- [ ] Custom dashboard in Axiom/Better Stack shows: requests/minute, error rate, p95 latency, top error codes
- [ ] Uptime monitoring alert configured: PagerDuty (or similar) alert if `/health` returns non-200 for > 2 minutes
- [ ] Alerts set for: error rate > 1%, p95 latency > 3s, D1 query errors > 10/minute
- [ ] Dashboard shared with the ops team (read-only access URL)
- [ ] `docs/infra/observability.md` documents all alert thresholds, dashboard URLs, and on-call runbook

**QA Verification:**
1. Trigger an intentional 500 error → alert fires within 2 minutes
2. Dashboard shows the error spike as a visible anomaly
3. Uptime monitor shows green (< 2-minute window) after health endpoint is restored

---

### Task 4.4: DNS Configuration — `api.webwaka.ng`, `app.webwaka.ng`, `discover.webwaka.ng`

**Priority:** LONG-TERM (PENDING in milestone tracker)
**Est:** 2h
**Files:**
- `docs/infra/dns-configuration.md` (CREATE)
**Dependencies:** [1.2, 1.3, 2.1]

**Acceptance Criteria:**
- [ ] `api.webwaka.ng` CNAME → `webwaka-api-production.workers.dev` (or Workers route in Cloudflare)
- [ ] `app.webwaka.ng` CNAME → `webwaka-brand-runtime-production.workers.dev`
- [ ] `discover.webwaka.ng` CNAME → `webwaka-public-discovery-production.workers.dev`
- [ ] `*.webwaka.ng` wildcard for tenant subdomains configured (Cloudflare for SaaS)
- [ ] HTTPS enforced on all subdomains (Cloudflare Universal SSL)
- [ ] HSTS preload submitted to hstspreload.org for `webwaka.ng`
- [ ] DNS propagation verified from Lagos, Abuja, Kano (use online DNS checker tools)

**QA Verification:**
1. `curl https://api.webwaka.ng/health` → `{ "ok": true }`
2. `curl https://discover.webwaka.ng/discover?q=shop` → returns results
3. `curl -I https://api.webwaka.ng/health` → includes `Strict-Transport-Security` header

---

### Task 4.5: Complete OpenAPI Specification — All 124 Vertical Endpoints

**Priority:** LONG-TERM (Extension of Task 2.7)
**Est:** 1w
**Files:**
- `docs/api/openapi.yaml` (EXTEND)
**Dependencies:** [2.7]

**Acceptance Criteria:**
- [ ] All 124 vertical route files have corresponding OpenAPI path documentation
- [ ] Every endpoint has: summary, tags, requestBody, responses (200, 400, 401, 403, 422, 429, 500)
- [ ] All schema types are defined in `components/schemas` (no inline schema repetition)
- [ ] `swagger-cli validate docs/api/openapi.yaml` passes
- [ ] Spec is generated (or validated) in CI as part of the `ci.yml` workflow

---

### Task 4.6: Campaign Finance — INEC e-Portal Integration Stub

**Priority:** LONG-TERM (Vertical gap — Civic)
**Est:** 1w
**Files:**
- `packages/verticals-campaign-office/src/inec.ts` (CREATE)
- `docs/compliance/inec-integration-plan.md` (CREATE)
**Dependencies:** [1.10]

**Acceptance Criteria:**
- [ ] `packages/verticals-campaign-office/src/inec.ts` defines the INEC data structure for campaign finance reporting
- [ ] `POST /api/v1/verticals/campaign-office/finance/report` generates a finance report in INEC-compatible format (JSON or PDF)
- [ ] Report export is available as a download (via R2 signed URL)
- [ ] If direct INEC e-portal API is unavailable: report is generated for manual submission
- [ ] `docs/compliance/inec-integration-plan.md` documents the INEC API integration plan and timeline

---

### Task 4.7: Real-Time Driver Tracking for Transport Verticals

**Priority:** LONG-TERM (Vertical gap — Transport)
**Est:** 2w
**Files:**
- `packages/verticals-rideshare/src/tracking.ts` (CREATE)
- `apps/api/src/routes/verticals/rideshare.ts` (MODIFY)
**Dependencies:** [4.1]

**Acceptance Criteria:**
- [ ] `PUT /api/v1/verticals/rideshare/drivers/:id/location` — updates driver location (lat/lng as integers in microdegrees — no floats)
- [ ] Cloudflare Durable Object (or KV with short TTL) stores latest driver location
- [ ] `GET /api/v1/verticals/rideshare/drivers/nearby?lat=<>&lng=<>&radiusKm=<>` — returns drivers within radius using Haversine formula (integer arithmetic)
- [ ] Location data is never stored in D1 (volatile, high-write) — KV or Durable Object only
- [ ] Location data TTL: 30 seconds (driver is considered offline after 30s without update)

---

### Task 4.8: Payment Automation — Auto-Release Escrow on Order Completion

**Priority:** LONG-TERM (Extension of Task 3.13)
**Est:** 1w
**Files:**
- `packages/payments/src/escrow.ts` (CREATE)
- `apps/api/src/routes/payments.ts` (MODIFY)
**Dependencies:** [3.13, 3.15]

**Acceptance Criteria:**
- [ ] When a commerce order transitions to `completed`, payment is automatically released to the seller via Paystack Transfer
- [ ] Escrow hold period: 24 hours after `completed` before auto-release (buyer dispute window)
- [ ] If dispute raised within 24 hours: escrow held until admin resolves
- [ ] Escrow release is idempotent — duplicate completion events do not trigger duplicate transfers
- [ ] All escrow amounts are integers in kobo (P9)

---

### Task 4.9: Staging → Production Promotion Runbook

**Priority:** LONG-TERM
**Est:** 1d
**Files:**
- `RELEASES.md` (CREATE)
**Dependencies:** [2.4, 1.4]

**Acceptance Criteria:**
- [ ] `RELEASES.md` documents the full promotion process: staging smoke tests → stakeholder sign-off → migration apply → production deploy → post-deploy smoke test → monitoring check
- [ ] A "go/no-go" checklist is included for production deployments
- [ ] Rollback procedure documented: revert Worker version via `wrangler rollback`
- [ ] Change freeze periods documented (e.g., no deploys between 6 PM and 8 AM WAT)
- [ ] On-call rotation contact list included

---

## DEPLOYMENT VALIDATION CHECKLIST

Before any production deployment:

- [ ] `pnpm typecheck` exits 0 — zero TypeScript errors
- [ ] `pnpm test` exits 0 — all unit tests pass
- [ ] `pnpm lint` exits 0 — no linting errors
- [ ] All smoke tests pass against staging
- [ ] Load test: p95 < 2s at 1,000 concurrent users
- [ ] Security scan: `pnpm audit` returns zero high/critical vulnerabilities
- [ ] All `wrangler.toml` files have valid Cloudflare resource IDs (no placeholders)
- [ ] All required Worker Secrets set: `JWT_SECRET`, `LOG_PII_SALT`, `PAYSTACK_SECRET_KEY`, `PRICE_LOCK_SECRET`, `DM_MASTER_KEY`, `INTER_SERVICE_SECRET`
- [ ] 182+ migrations applied to production D1 (`wrangler d1 migrations apply webwaka-production`)
- [ ] HTTPS enforced on all public endpoints
- [ ] Security headers present on API responses (verified with `curl -I`)
- [ ] Rate limiting active (verified with rapid-fire test)
- [ ] Error monitoring active (verified by triggering a test error)
- [ ] Backup of staging D1 taken before production migration apply
- [ ] 24-hour staging smoke test run (deploy to staging → monitor for 24h → no alerts → promote)
- [ ] All verticals functional: health, claims, commerce, civic, transport, POS (representative test per category)
- [ ] NDPR consent flows tested end-to-end (OTP consent, channel consent, withdrawal)
- [ ] Privacy Policy v2 accessible at public URL
- [ ] Partner admin portal functional (at minimum: list tenants, list workspaces)
- [ ] DNS configured and propagated (verify from 3 geographic locations)
- [ ] Rollback procedure tested at least once on staging

---

## PRODUCTION DAY 1 CHECKLIST

Complete in order:

1. **Database ready** — All 182+ migrations applied to production D1; verified with table count query
2. **Secrets provisioned** — All 7+ Worker Secrets set in Cloudflare production environment
3. **Workers deployed** — All 8 apps deployed to production via `wrangler deploy --env production`
4. **DNS live** — `api.webwaka.ng`, `app.webwaka.ng`, `discover.webwaka.ng` resolving correctly
5. **Health checks green** — `curl https://api.webwaka.ng/health` → `{ "ok": true }` from 3 locations
6. **Payments verified** — Paystack production keys active; test transaction of ₦100 initiated and completed
7. **First tenant onboarded** — Pilot partner tenant created; workspace claimed; at least one listing active
8. **Monitoring active** — Logpush running; first log lines arriving in Axiom/Better Stack; uptime monitor showing green
9. **Alerts configured** — Error rate, latency, and uptime alerts verified to fire (test alert sent)
10. **Smoke tests pass** — Production smoke test suite run and all tests pass
11. **Privacy Policy accessible** — `https://webwaka.ng/legal/privacy` returns valid policy page
12. **Support channel open** — Customer support email, WhatsApp, or Telegram channel active for Day 1 issues
13. **On-call engineer confirmed** — At least one engineer on-call for the first 48 hours post-launch
14. **Rollback plan ready** — `wrangler rollback` command prepared; previous Worker version ID noted
15. **Load test passed** — Staging load test results confirm platform handles 1,000 concurrent users

---

## ASSUMPTIONS MADE

All assumptions are derived directly from the audit. No external assumptions introduced.

1. **Cloudflare D1 IDs from milestone tracker are still valid** — The staging ID `cfa62668` and production ID `de1d0935` were provisioned per the milestone tracker. If the Cloudflare account has been reset or these databases deleted, Task 1.2 must include reprovisioning them via `wrangler d1 create`.

2. **KV namespace IDs are in the milestone tracker** — The audit references that KV IDs are "known." Task 1.2 assumes they can be retrieved from `docs/governance/milestone-tracker.md`. If not present there, they must be retrieved from the Cloudflare Dashboard.

3. **GitHub Actions secrets were set in the original repo fork** — The milestone tracker marks this as "DONE." Task 1.3 is a verification task. If secrets were lost due to a repo transfer, they must be re-created.

4. **Paystack sandbox credentials exist** — Tasks 1.9, 2.3, 3.5, 3.15 assume Paystack sandbox API keys are available. If not, they must be obtained from the Paystack dashboard before payment tasks can be QA-verified.

5. **Prembly API key available** — Tasks 3.2 and 3.6 assume Prembly API access. If the account is not set up, Task 3.2 cannot be QA-verified against a real BVN.

6. **No mobile app in scope** — The audit found no mobile app in the repository. This plan covers web (browser + PWA) only. A native Android/iOS app is out of scope for this 90-day plan.

7. **`staging` branch will be created fresh** — All current commits are on `main`. Task 1.4 creates the `staging` branch from `main`. If the branch already exists with different content, a merge strategy must be defined.

8. **Audit gap — `packages/offerings/` purpose unclear** — If this package is consumed by any route, it must be traced and its completeness verified. A clarification task is created implicitly if `pnpm typecheck` reveals errors from it after Phase 1.

9. **Audit gap — `apps/tenant-public/` vs `apps/brand-runtime/`** — Both appear to serve tenant-facing pages. Task 4.1 (frontend SPA) must determine which is canonical before investing in either. A clarification spike of 2h should precede Task 4.1 to resolve this overlap.

10. **Audit gap — `packages/auth-tenancy/` vs `packages/auth/`** — The functional difference between these two packages must be traced before Phase 2 tasks that modify the auth flow (e.g., partner JWT with `partnerId`). A 2h clarification spike is recommended at the start of Week 3.

---

*End of Remediation Plan — 2026-04-10*
*Coverage: 100% of audit findings (7 blockers, 10 high, 11 medium, vertical gaps, infrastructure, security, frontend, monitoring, documentation)*
*Zero-issue guarantee: Every audit item has at least one task. No findings without a task.*
