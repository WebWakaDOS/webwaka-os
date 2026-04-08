# M7e + M7f + M7 QA Gate — QA Brief

**Date:** 2026-04-08
**Milestone:** M7e (Nigeria UX Polish) + M7f (Multi-Channel Contact Full Implementation) + M7 QA Launch Gate
**Repository:** https://github.com/WebWakaDOS/webwaka-os
**Implementation Brief:** `docs/milestones/m7ef-replit-brief.md`
**QA Lead:** Expert QA Engineer
**Environment:** Cloudflare Workers + Hono + D1 + TypeScript strict mode
**Baseline:** 609 passing tests across 17 packages — HEAD `4f56ebf`

---

## 1. Scope

This QA pass covers all deliverables introduced in M7e, M7f, and the M7 QA Gate:

| Deliverable | Files | Min Tests |
|---|---|---|
| **M7e** — Airtime top-up API | `apps/api/src/routes/airtime.ts` | ≥ 8 |
| **M7e** — LGA/State/Ward selector API | `apps/api/src/routes/geography.ts` | ≥ 5 |
| **M7e** — Naija Pidgin (pcm) locale | `packages/frontend/src/i18n/pcm.ts`, `en.ts`, `index.ts` | ≥ 4 |
| **M7e** — Low-data mode middleware | `apps/api/src/middleware/low-data.ts` | ≥ 3 |
| **M7e** — USSD shortcode utility | `packages/frontend/src/ussd-shortcode.ts` | ≥ 4 |
| **M7e** — PWA manifest + service worker | `apps/platform-admin/public/manifest.json`, `sw.js` | Lighthouse audit |
| **M7f** — Migration 0035 | `infra/db/migrations/0035_contact_telegram_chat_id.sql` | Schema check |
| **M7f** — ContactService + P12/P13 | `packages/contact/src/contact-service.ts` | ≥ 10 |
| **M7f** — OTP routing (R8) | `packages/contact/src/channel-resolver.ts` | ≥ 5 |
| **M7f** — Telegram Bot webhook | `apps/ussd-gateway/src/telegram.ts` | ≥ 5 |
| **M7f** — WhatsApp 360dialog | `packages/otp/src/whatsapp-meta.ts` | ≥ 3 |
| **M7f** — P13 auth guard | `packages/auth/src/guards.ts` | ≥ 2 |
| **M7f** — contact.ts refactor | `apps/api/src/routes/contact.ts` | existing 7 tests must still pass |
| **M7f** — Integration smoke tests | `apps/api/src/routes/integration.test.ts` | ≥ 6 |
| **M7 QA Gate** — Float reconciliation | `apps/api/src/routes/pos.test.ts` | ≥ 3 |
| **M7 QA Gate** — NITDA self-assessment | `docs/qa/nitda-self-assessment.md` | Doc review |
| **M7 QA Gate** — CBN KYC audit | `docs/qa/cbn-kyc-audit.md` | Doc review |
| **M7 QA Gate** — NDPR consent audit | `docs/qa/ndpr-consent-audit.md` | Doc review |
| **M7 QA Gate** — Security review | `docs/qa/security-review-m7.md` | Doc review |

**Total new tests expected: ≥ 46** (platform total: ≥ 655)

---

## 2. Environment Setup

### 2.1 Prerequisites

```bash
node --version   # must be 20.x or 22.x
pnpm --version   # must be 9.x or 10.x
git log --oneline -3  # confirm HEAD is on feat/m7ef-nigeria-ux-contact branch
```

### 2.2 Install and verify baseline

```bash
git clone https://github.com/WebWakaDOS/webwaka-os.git
cd webwaka-os
git checkout feat/m7ef-nigeria-ux-contact
pnpm install

# Confirm baseline tests pass BEFORE reviewing M7e/M7f additions
pnpm -r test 2>&1 | grep "Tests.*passed"
# Expected: all 609 baseline tests pass. If any fail, STOP — do not proceed with QA review.
```

### 2.3 Run all tests (complete suite)

```bash
# Full workspace test run
pnpm -r test

# Or per-package
pnpm --filter @webwaka/contact test
pnpm --filter @webwaka/otp test
pnpm --filter @webwaka/auth test
pnpm --filter @webwaka/frontend test
pnpm --filter @webwaka/api test
pnpm --filter @webwaka/ussd-gateway test
```

### 2.4 Typecheck (critical — must be 0 errors)

```bash
pnpm -r typecheck
# Expected: zero TypeScript errors across ALL packages and apps
# Any error is a P0 blocker — do not approve until clean
```

### 2.5 Lint

```bash
pnpm -r lint
# Expected: no lint errors in new M7e/M7f files
```

### 2.6 Invariant grep checks (run before code review)

```bash
# P7 — No direct AI SDK imports
grep -r "openai\|anthropic\|@anthropic-ai\|openai-sdk" packages/ apps/ --include="*.ts"
# Expected: zero matches

# T3 — No SQL query without tenant_id (new files only)
grep -n "SELECT\|INSERT\|UPDATE\|DELETE" apps/api/src/routes/airtime.ts 2>/dev/null | grep -v "tenant_id"
# Expected: zero matches (airtime queries must all bind tenantId)

# No floating point money in new code
grep -rn "toFixed\|parseFloat\|0\." apps/api/src/routes/airtime.ts 2>/dev/null
# Expected: zero matches (kobo only)

# P14 — DM_MASTER_KEY still asserted at startup
grep -n "assertDMMasterKey" apps/api/src/index.ts
# Expected: one match before any route registration
```

---

## 3. Platform Invariants to Verify

These are non-negotiable. Any violation is a **P0 bug** that blocks PR merge.

| ID | Rule | Where Enforced | How to Verify |
|---|---|---|---|
| **P2** | Nigeria First — airtime uses Naira kobo | `apps/api/src/routes/airtime.ts` | Confirm `amount_kobo` is validated as integer. Confirm Termii receives naira (kobo÷100) not a float. |
| **P6** | Offline First — low-data mode never drops text | `apps/api/src/middleware/low-data.ts` | Confirm `media_urls` is replaced with `[]` not removed. Confirm `content`, `title`, `body` fields pass through. |
| **P9** | Float Integrity — airtime amounts are integer kobo | `apps/api/src/routes/airtime.ts` | Pass `amount_kobo: 5.5` → must throw 422. Pass `amount_kobo: 5000` → must proceed. |
| **P10** | NDPR Consent — contact OTP requires consent record | `packages/contact/src/contact-service.ts::assertChannelConsent` | Call `assertChannelConsent(db, userId, 'sms', tenantId)` with no consent row in DB → must throw `ContactError('CONSENT_REQUIRED')`. |
| **P12** | Multi-channel consent enforced per channel | `packages/contact/src/contact-service.ts::assertChannelConsent` | Verify consent check fires for each channel type: sms, whatsapp, telegram, email. |
| **P13** | Primary phone is mandatory | `packages/contact/src/contact-service.ts::assertPrimaryPhoneVerified` and `packages/auth/src/guards.ts::requirePrimaryPhoneVerified` | Call with no verified primary SMS row → throws `ContactError('PRIMARY_PHONE_REQUIRED')` / `AuthError('PRIMARY_PHONE_REQUIRED')`. |
| **P14** | DM encryption at rest — unchanged from M7c | `packages/social/src/dm.ts::assertDMMasterKey` | Confirm still called in `apps/api/src/index.ts` before routes. No regression from contact.ts refactor. |
| **P15** | Moderation-first — unchanged from M7c | `packages/community/src/channel.ts`, `packages/social/src/social-post.ts` | Confirm no regression — `classifyContent` still called before INSERT in both. |
| **R8** | Transaction OTP must use SMS (not Telegram) | `packages/contact/src/channel-resolver.ts::routeOTPByPurpose` | Call `routeOTPByPurpose(channels, 'transaction', 'telegram')` → result must NOT include Telegram channel. |
| **T2** | TypeScript strict — 0 `any` without comment | All new M7e/M7f files | `pnpm -r typecheck` — 0 errors. `grep -rn ": any" packages/contact/src/contact-service.ts` — zero unless commented. |
| **T3** | Tenant isolation on all queries | `airtime.ts`, `geography.ts`, `contact-service.ts` | Grep for SQL without `tenant_id` predicate (geography is documented exception). |
| **T4** | Integer kobo only | `airtime.ts`, `contact-service.ts` | Grep for `toFixed\|parseFloat` in airtime/contact service files — must be zero. |

---

## 4. M7e QA Checks

### 4.1 Migration — None

M7e does not introduce new D1 migrations. Skip migration checks for this deliverable.

---

### 4.2 Airtime Top-Up Route (`apps/api/src/routes/airtime.ts`)

**File must exist:** `apps/api/src/routes/airtime.ts`

| Check | Expected | How to Verify |
|---|---|---|
| Route is wired in `apps/api/src/index.ts` | `app.route('/airtime', airtimeRoutes)` | `grep "airtime" apps/api/src/index.ts` — one match |
| Auth middleware on `/airtime/*` | `app.use('/airtime/*', authMiddleware)` | `grep "airtime.*auth\|auth.*airtime" apps/api/src/index.ts` |
| `amount_kobo` is integer-validated | 422 on float input | `POST /airtime/topup { phone: "+2348030000001", amount_kobo: 5.5 }` → 422 |
| `amount_kobo` minimum is 5000 kobo (₦50) | 422 on below-min | `POST /airtime/topup { ..., amount_kobo: 4000 }` → 422 |
| Phone validated as Nigerian E.164 | 400 on invalid | `POST /airtime/topup { phone: "+447911123456", ... }` → 400 (UK number) |
| Rate limiting applied | 429 on 6th request | Mock KV rate counter → 6th request → 429 |
| KYC Tier 1 required | 403 on Tier 0 user | Mock auth with `kycTier: 0` → 403 |
| T3: `tenantId` used in float query | No missing tenant_id | `grep "tenantId" apps/api/src/routes/airtime.ts` — appears in all D1 queries |
| T4: No float arithmetic on kobo | No `toFixed`/`parseFloat` | `grep "toFixed\|parseFloat" apps/api/src/routes/airtime.ts` — zero |
| Auto-detect network from prefix | Network resolved correctly | Test MTN prefix (0803) → network = 'MTN' |

**Test file check:** `apps/api/src/routes/airtime.test.ts` must exist with ≥ 8 test cases.

---

### 4.3 Geography Routes (`apps/api/src/routes/geography.ts`)

| Check | Expected | How to Verify |
|---|---|---|
| `GET /geography/states` returns 200 | Array of Nigerian states | Run test — confirm 36 + FCT = 37 states |
| `GET /geography/lgas?stateId=...` returns 200 | LGAs for that state | Test with a known stateId |
| `GET /geography/lgas` without `stateId` returns 400 | `{ error: "stateId is required" }` | Run test |
| `GET /geography/wards?lgaId=...` returns 200 | Wards array | Run test with known lgaId |
| Cache-Control header present | `public, max-age=86400` | Check response headers in test |
| **No auth required** — public route | 200 without JWT | Request without Authorization header → 200 |
| `LIMIT 500` on queries | Never unbounded | `grep "LIMIT" apps/api/src/routes/geography.ts` — appears on all queries |
| T3 exception documented | Comment in file | `grep "T3.*exception\|geography.*public\|no tenant" apps/api/src/routes/geography.ts` |

**Test file check:** `apps/api/src/routes/geography.test.ts` must exist with ≥ 5 test cases.

---

### 4.4 Naija Pidgin (pcm) Locale (`packages/frontend/src/i18n/`)

**Files must exist:**
- `packages/frontend/src/i18n/pcm.ts`
- `packages/frontend/src/i18n/en.ts`
- `packages/frontend/src/i18n/index.ts`

| Check | Expected | How to Verify |
|---|---|---|
| `pcmLocale` has same keys as `enLocale` | Zero missing keys | Test: `Object.keys(enLocale).every(k => k in pcmLocale)` → true |
| `pcmLocale['auth.login']` is Pidgin | `'Enter'` (not 'Login') | Direct assertion in test |
| `pcmLocale['wallet.balance']` contains `₦{{amount}}` | Template token present | Direct assertion |
| `pcmLocale['nav.discover']` is Pidgin | `'Find Tings'` (not 'Discover') | Direct assertion |
| No English copy-paste in pcm (no identical strings) | All keys have distinct pcm translation | `Object.entries(pcmLocale).filter(([k, v]) => v === enLocale[k])` should be empty or document exceptions |
| `pcmLocale['error.network']` mentions "wahala" or equivalent Pidgin | Cultural Pidgin usage | Spot check key content |
| `i18n/index.ts` exports `pcmLocale`, `enLocale`, `LocaleKey` | All 3 exported | `grep "export" packages/frontend/src/i18n/index.ts` |
| `packages/frontend/src/index.ts` re-exports i18n | Module accessible from package root | `grep "i18n\|pcm\|locale" packages/frontend/src/index.ts` |

**Test file check:** `packages/frontend/src/i18n.test.ts` must exist with ≥ 4 test cases.

---

### 4.5 Low-Data Mode Middleware (`apps/api/src/middleware/low-data.ts`)

| Check | Expected | How to Verify |
|---|---|---|
| Middleware only activates on `X-Low-Data: 1` header | Without header: no change to response | Test response with and without header |
| `media_urls` replaced with `[]` (not removed) | `{ media_urls: [] }` in response | Test with post containing media_urls — check field is present but empty |
| Nested `media_urls` stripped | Deep stripping works | Test with nested `{ posts: [{ media_urls: [...] }] }` |
| `content`, `title`, `body` never stripped | Text fields pass through | Assert text fields identical in stripped response |
| Non-JSON responses pass through unchanged | Binary/text responses unaffected | Test a non-JSON endpoint with `X-Low-Data: 1` — no modification |
| Registered globally AFTER auth middleware | Order correct | `grep -n "lowDataMiddleware\|authMiddleware" apps/api/src/index.ts` — auth line number < lowData line number |

**Test cases:** minimum 3 new tests in `apps/api` test suite.

---

### 4.6 USSD Shortcode Utility (`packages/frontend/src/ussd-shortcode.ts`)

| Check | Expected | How to Verify |
|---|---|---|
| `USSD_SHORTCODE === '*384#'` | Exact string match | Direct assertion in test |
| `formatUSSDPrompt('en')` includes `*384#` | English prompt contains shortcode | Assertion in test |
| `formatUSSDPrompt('pcm')` includes `*384#` and Pidgin | Pidgin version includes shortcode | Assertion in test |
| `getUSSDDialLink()` returns `tel:%2A384%23` | URL-encoded tel link | Assertion in test |
| Exported from `packages/frontend/src/index.ts` | Package consumers can import | `grep "ussd-shortcode\|USSD_SHORTCODE\|formatUSSDPrompt" packages/frontend/src/index.ts` |

**Test file check:** `packages/frontend/src/i18n.test.ts` or `ussd-shortcode.test.ts` — ≥ 4 shortcode tests.

---

### 4.7 PWA Files (`apps/platform-admin/public/`)

**Files must exist:**
- `apps/platform-admin/public/manifest.json`
- `apps/platform-admin/public/sw.js`

| Check | Expected | How to Verify |
|---|---|---|
| `manifest.json` has required fields | `name`, `short_name`, `start_url`, `display`, `icons`, `theme_color` | Read file — all fields present |
| `manifest.json` `display` is `standalone` | Installable PWA | `grep "standalone" apps/platform-admin/public/manifest.json` |
| `manifest.json` `lang` is `en-NG` | Nigeria-first locale | `grep "en-NG" apps/platform-admin/public/manifest.json` |
| `manifest.json` has 192×192 and 512×512 icons | Lighthouse requires both sizes | Check `icons` array |
| `sw.js` handles `install`, `activate`, `fetch` events | Service worker is functional | Read file — 3 event listeners present |
| `sw.js` calls `self.skipWaiting()` in install | Immediate activation | `grep "skipWaiting" apps/platform-admin/public/sw.js` |
| `server.js` serves manifest.json with correct content-type | `application/manifest+json` or `application/json` | Check server.js response handler |

**Lighthouse audit:** Run `npx lighthouse http://localhost:5000 --only-categories=pwa --output=json` against the running `apps/platform-admin`. PWA score must be ≥ 80. Document the score in `docs/qa/nitda-self-assessment.md`.

---

## 5. M7f QA Checks

### 5.1 Migration 0035 (`infra/db/migrations/0035_contact_telegram_chat_id.sql`)

**File must exist:** `infra/db/migrations/0035_contact_telegram_chat_id.sql`

| Check | Expected | How to Verify |
|---|---|---|
| Uses `ALTER TABLE contact_channels ADD COLUMN telegram_chat_id TEXT` | Safe nullable column | Read file |
| `IF NOT EXISTS` equivalent or safe `ALTER TABLE` | Idempotent on D1 | D1 does not support `IF NOT EXISTS` for ALTER — confirm the migration is written as a plain `ALTER TABLE ADD COLUMN` which D1 silently ignores if column already exists (D1 behavior) OR wrapped in a CREATE TABLE migration check |
| Index created for `telegram_chat_id` | Performance index | `grep "INDEX.*telegram" 0035_*.sql` |
| File is in numeric order | 0035 follows 0034 | `ls infra/db/migrations/ | sort` — 0035 comes after 0034 |
| Migration number 0034 is the previous | No gap | Confirm 0034 exists and 0035 is the next in sequence |

---

### 5.2 ContactService (`packages/contact/src/contact-service.ts`)

**File must exist:** `packages/contact/src/contact-service.ts`

**Function-by-function audit:**

| Function | P0 Check | Expected Behaviour |
|---|---|---|
| `upsertContactChannels()` | T3: `tenantId` in all queries | All D1 calls bind tenantId |
| `upsertContactChannels()` | P13: primary SMS cannot be removed | If `channels` array has no `channel_type: 'sms'`, throw `ContactError('CANNOT_REMOVE_PRIMARY')` |
| `getContactChannels()` | T3: `tenantId` in query | D1 WHERE includes `AND tenant_id = ?` or equivalent |
| `markChannelVerified()` | Sets `verified = 1` AND `verified_at = unixepoch()` | Two columns updated, not just one |
| `updateTelegramChatId()` | Server-side only | No client input validation — this is an internal server call |
| `removeContactChannel()` | P13: cannot remove primary SMS | Call with `channel_type: 'sms'` → throws `ContactError('CANNOT_REMOVE_PRIMARY')` |
| `assertChannelConsent()` | **P12 critical** | Query: `SELECT id FROM consent_records WHERE user_id=? AND data_type=? AND withdrawn_at IS NULL LIMIT 1` — if null → throws `ContactError('CONSENT_REQUIRED')` |
| `assertChannelConsent()` | P12: data_type mapping | `sms` → `'phone'`, `whatsapp` → `'whatsapp'`, `telegram` → `'telegram'`, `email` → `'email'` |
| `assertPrimaryPhoneVerified()` | **P13 critical** | Query: `SELECT id FROM contact_channels WHERE user_id=? AND channel_type='sms' AND is_primary=1 AND verified=1` — if null → throws `ContactError('PRIMARY_PHONE_REQUIRED')` |
| `ContactError` exported | Package consumers can catch it | `grep "ContactError" packages/contact/src/index.ts` |

**P12 invariant test (must be in the test suite):**

```typescript
it('P12: assertChannelConsent throws CONSENT_REQUIRED when no active consent row', async () => {
  const db = mockDb({ consentRecords: [] }); // No consent rows
  await expect(
    assertChannelConsent(db, 'user_001', 'sms', 'tenant_001')
  ).rejects.toThrow('CONSENT_REQUIRED');
});
```

**P13 invariant test (must be in the test suite):**

```typescript
it('P13: assertPrimaryPhoneVerified throws PRIMARY_PHONE_REQUIRED when phone unverified', async () => {
  const db = mockDb({ contactChannels: [] }); // No channels
  await expect(
    assertPrimaryPhoneVerified(db, 'user_001', 'tenant_001')
  ).rejects.toThrow('PRIMARY_PHONE_REQUIRED');
});
```

**Test file check:** `packages/contact/src/contact.test.ts` must cover ≥ 10 test cases for M7f additions.

---

### 5.3 OTP Routing Algorithm (R8) (`packages/contact/src/channel-resolver.ts`)

**Function must exist:** `routeOTPByPurpose(channels, purpose, preference): OTPContactTarget[]`

| Check | R8 Rule | Expected |
|---|---|---|
| `'transaction'` + `'telegram'` preference | Telegram blocked for transactions | Returns SMS or WA — never Telegram |
| `'transaction'` with only Telegram verified channel | No eligible channel | Throws `OTPRoutingError('NO_ELIGIBLE_CHANNEL')` |
| `'kyc_uplift'` + `'telegram'` preference | Telegram blocked for KYC | Returns SMS — never Telegram |
| `'verification'` + `'telegram'` preference | Telegram allowed | Returns Telegram channel first |
| `'login'` + `'telegram'` preference | Telegram allowed | Returns Telegram channel first |
| `'password_reset'` + all channels | All channels allowed | Returns preference order |
| Empty channels array | Always throws | `OTPRoutingError('NO_ELIGIBLE_CHANNEL')` regardless of purpose |
| `OTPRoutingError` exported | Package consumers can catch | `grep "OTPRoutingError" packages/contact/src/index.ts` |

**Critical R8 test:**
```typescript
it('R8: transaction OTPs cannot be routed through Telegram', () => {
  const channels: ContactChannelRecord[] = [
    { channel_type: 'telegram', value: '@alice', verified: true, is_primary: false },
    // No SMS or WhatsApp
  ];
  expect(() => routeOTPByPurpose(channels, 'transaction', 'telegram'))
    .toThrow('NO_ELIGIBLE_CHANNEL');
});
```

**Test file check:** `packages/contact/src/contact.test.ts` must contain ≥ 5 OTP routing tests.

---

### 5.4 `apps/api/src/routes/contact.ts` Refactor

The contact routes must be refactored to use `ContactService`. Verify the refactor is correct and no regression.

| Check | Expected | How to Verify |
|---|---|---|
| Existing tests still pass | All 7 existing contact route tests green | `pnpm --filter @webwaka/api test` — check contact test file passes |
| Inline D1 queries removed | Routes delegate to ContactService | `grep "db.prepare\|db\.prepare" apps/api/src/routes/contact.ts` — zero or minimal matches |
| `assertChannelConsent()` called before OTP send | P12 enforced | `grep "assertChannelConsent" apps/api/src/routes/contact.ts` — one match before OTP dispatch |
| `markChannelVerified()` called on OTP confirmation | Contact service handles verified update | `grep "markChannelVerified" apps/api/src/routes/contact.ts` |
| Rate limiting unchanged | R9 rate limits still applied | Confirm `RATE_LIMIT_KV` still referenced in route file |
| Auth middleware unchanged | Auth still required | `apps/api/src/index.ts` still has `app.use('/contact/*', authMiddleware)` |
| No new `D1Like` interface defined locally | Removed in favour of ContactService | `grep "interface D1Like" apps/api/src/routes/contact.ts` — zero (ContactService owns this) |

---

### 5.5 Telegram Bot Webhook (`apps/ussd-gateway/src/telegram.ts`)

**File must exist:** `apps/ussd-gateway/src/telegram.ts`

| Check | Expected | How to Verify |
|---|---|---|
| Webhook secret validated | `X-Telegram-Bot-Api-Secret-Token` header checked | `grep "TELEGRAM_WEBHOOK_SECRET\|X-Telegram-Bot" apps/ussd-gateway/src/telegram.ts` |
| Invalid secret → 403 | Not 401 or 200 | Test with wrong header value → 403 |
| Valid update: `/start` from known user → updates chat_id | `UPDATE contact_channels SET telegram_chat_id=?` | Test with mock DB — confirms UPDATE called |
| Valid update: `/start` from unknown user → reply message | `sendTelegramMessage()` called with "not registered" text | Test with mock DB — no such user → message sent |
| Non-`/start` message → 200 (no action) | Graceful handling | Test with regular text message → 200, no DB write |
| Missing `message` field → 200 | Handles malformed update | Test with `{ update_id: 1 }` → 200 |
| `POST /telegram/webhook` wired in `apps/ussd-gateway/src/index.ts` | Route registered | `grep "telegram\|webhook" apps/ussd-gateway/src/index.ts` |
| Telegram Bot API called via `fetch` (no SDK) | T1/T2 compliant | `grep "require\|import.*node-telegram\|grammy\|telegraf" apps/ussd-gateway/src/telegram.ts` — zero |

**Test file check:** `apps/ussd-gateway/src/telegram.test.ts` must exist with ≥ 5 test cases.

---

### 5.6 WhatsApp 360dialog Support (`packages/otp/src/whatsapp-meta.ts`)

| Check | Expected | How to Verify |
|---|---|---|
| `WHATSAPP_PROVIDER` env var controls routing | `'termii'` or `'360dialog'` | `grep "WHATSAPP_PROVIDER" packages/otp/src/multi-channel.ts` |
| 360dialog function uses correct API endpoint | `https://waba.360dialog.io/v1/messages` | `grep "360dialog\|waba.360dialog" packages/otp/src/whatsapp-meta.ts` |
| 360dialog uses `D360-API-KEY` header | Correct auth header | `grep "D360-API-KEY\|DIALOG360_API_KEY" packages/otp/src/whatsapp-meta.ts` |
| Termii path unchanged when `WHATSAPP_PROVIDER = 'termii'` | No regression | Existing WhatsApp tests still pass |
| R8 guard unchanged | Transaction OTPs still blocked on WA Telegram | `grep "transaction.*throw\|purpose.*transaction" packages/otp/src/whatsapp-meta.ts` |

**Test check:** `packages/otp` tests must include ≥ 3 new cases for 360dialog.

---

### 5.7 P13 Auth Guard (`packages/auth/src/guards.ts`)

| Check | Expected | How to Verify |
|---|---|---|
| `requirePrimaryPhoneVerified()` function exported | Available to import | `grep "requirePrimaryPhoneVerified" packages/auth/src/index.ts` |
| No import from `packages/contact` | No circular dependency | `grep "from '@webwaka/contact'" packages/auth/src/guards.ts` — zero |
| D1 query inline in guards.ts | Self-contained | D1 query for `contact_channels` WHERE condition is in guards.ts |
| Throws on no verified primary phone | P13 enforced | Test: empty contact_channels → throws |
| `AuthError` or platform error with `'PRIMARY_PHONE_REQUIRED'` code | Typed error | Test catches specific error code |

**Tests:** ≥ 2 new tests in `packages/auth` test suite.

---

### 5.8 Cross-Vertical Integration Smoke Tests (`apps/api/src/routes/integration.test.ts`)

**File must exist:** `apps/api/src/routes/integration.test.ts`

All 6 integration scenarios must pass:

| Scenario | What it validates | Must assert |
|---|---|---|
| NDPR consent → join community | P10 enforcement end-to-end | `POST /community/join` returns 200 when consent row exists; 403 when missing |
| Authenticated + verified phone → paid community join | P13 + KYC T1 + community | Verified phone user can join Tier 1-priced community |
| DM encryption end-to-end | P14 — AES-GCM at rest | `sendDM()` → D1 content is ciphertext; `decryptDMContent()` → original plaintext |
| USSD Branch 3 trending | USSD + social integration | Branch 3 pre-fetches `social_posts` sorted by `like_count DESC` — top 5 returned |
| Offline post → sync apply | P11 — sync FIFO | Dexie queue item → `POST /sync/apply` → post appears in channel posts |
| Contact verify → P12 gate | P12 — no consent = blocked | `POST /contact/verify/telegram` without consent_records → 403 CONSENT_REQUIRED |

---

## 6. M7 QA Gate Checks

### 6.1 TypeScript Strict Typecheck

```bash
pnpm -r typecheck
```

**Result must be:** Zero TypeScript errors across all 17 packages + apps.

Any error is a **P0 blocker**. Common failure patterns to check:

| Failure | File | Fix |
|---|---|---|
| `ContactError` not exported from index.ts | `packages/contact/src/index.ts` | Add `export { ContactError } from './contact-service.js'` |
| `OTPRoutingError` not exported | `packages/contact/src/index.ts` | Add export |
| `OTPPurpose` type not exported | `packages/contact/src/index.ts` | Add type export |
| `routeOTPByPurpose` missing in index.ts | `packages/contact/src/index.ts` | Add export |
| `requirePrimaryPhoneVerified` not in auth index.ts | `packages/auth/src/index.ts` | Add export |
| Missing `TELEGRAM_WEBHOOK_SECRET` in env type | `apps/ussd-gateway/src/env.ts` or inline Env | Add to Env interface |
| Missing `WHATSAPP_PROVIDER` in api env type | `apps/api/src/env.ts` | Add optional field |
| Missing `DIALOG360_API_KEY` in api env type | `apps/api/src/env.ts` | Add optional field |

---

### 6.2 Full Test Suite Count

**Command:**
```bash
pnpm -r test 2>&1 | grep "Tests.*passed"
```

**Expected minimum:**

| Package/App | Baseline | M7e/M7f new | Required total |
|---|---|---|---|
| `packages/contact` | 15 | ≥ 10 | ≥ 25 |
| `packages/otp` | 26 | ≥ 3 | ≥ 29 |
| `packages/auth` | 34 | ≥ 2 | ≥ 36 |
| `packages/frontend` | 45 | ≥ 7 | ≥ 52 |
| `apps/api` | 144 | ≥ 16 | ≥ 160 |
| `apps/ussd-gateway` | 85 | ≥ 5 | ≥ 90 |
| All other packages | 260 | 0 | 260 |
| **Platform total** | **609** | **≥ 43** | **≥ 652** |

If any existing test regresses to FAIL, it is a **P0 blocker** — all existing 609 tests must remain green.

---

### 6.3 Float Ledger Reconciliation Test

**File:** `apps/api/src/routes/pos.test.ts`

**Must contain "Float ledger reconciliation" test group** with the following 3 minimum assertions:

1. **Idempotency:** Sending the same Paystack reference twice does not double-credit the wallet (UNIQUE constraint on `reference` column in `float_ledger`).

2. **Reversal:** A reversal of a debit entry correctly restores the previous balance. The ledger is append-only — no row deleted.

3. **Negative balance guard:** Attempting to debit more than the current balance throws `InsufficientFloatError` and does NOT write to D1.

**Grading criteria:** All three assertions must pass in the same test file as existing POS tests. The test must use the same mock D1 pattern as existing `pos.test.ts` tests.

---

### 6.4 NITDA Self-Assessment Document

**File must exist:** `docs/qa/nitda-self-assessment.md`

**QA reviewer must check each of the 12 NITDA provisions is addressed:**

| Provision | Status Options | Acceptable Gap |
|---|---|---|
| 1. Content moderation policy | Must be at least "Partially Compliant" | AI classifier stub is documented — P15 moderation-first |
| 2. Hate speech / harassment | Must be addressed | `moderation_log` + `content_flags` tables + classifier categories |
| 3. User reporting tools | Must be addressed | `POST /social/posts/:id/report` + `POST /community/channels/:id/posts/:postId/flag` routes |
| 4. Government data requests | Must be addressed | Contact: legal@webwaka.com + 72-hour SLA |
| 5. Transparency reporting | "Action Required" is acceptable | Annual — not yet launched |
| 6. Local content support | Must be Compliant | `pcm` locale + Naija Pidgin language field in social posts |
| 7. Data localisation | Must be addressed | Cloudflare D1 — document data centre region |
| 8. Child safety | Must be addressed | KYC age gate (all paid tiers require Tier 1 = phone + name) |
| 9. Misinformation | Must be addressed | AI moderation classifier + manual review queue |
| 10. Appeals process | Must be addressed | 7-day appeal window documented in community moderation |
| 11. Privacy settings | Must be Compliant | NDPR consent records + withdrawal flow |
| 12. Platform liability | Must be addressed | NDPR + Nigerian law compliance noted |

---

### 6.5 CBN KYC Compliance Audit Document

**File must exist:** `docs/qa/cbn-kyc-audit.md`

**Reviewer checks:**

| KYC Tier | Daily Limit | Enforcement Point | Test Evidence Required |
|---|---|---|---|
| Tier 0 | ₦0 | `assertWithinTierLimits(0, amount)` → throws | Test in `packages/entitlements` showing Tier 0 cannot transact |
| Tier 1 | ₦50,000/day | `requireKYCTier(ctx, 1)` on paid community tiers ≥ ₦1 | Test in `apps/api/routes/pos.test.ts` or `community.test.ts` |
| Tier 2 | ₦200,000/day | `requireKYCTier(ctx, 2)` on community tiers ≥ ₦50,000/yr | Test in identity or pos routes |
| Tier 3 | Unlimited | `requireKYCTier(ctx, 3)` on agent float > ₦2M | Test in `packages/entitlements/guards.test.ts` |

Document must also confirm:
- BVN lookup requires prior consent (P10) — test evidence
- KYC tier upgrade is irreversible (no downgrade path in code)
- `assertWithinTierLimits()` imported from `@webwaka/entitlements` at each enforcement point

---

### 6.6 NDPR Consent Records Audit Document

**File must exist:** `docs/qa/ndpr-consent-audit.md`

**Reviewer checks — all 11 `data_type` values must be documented:**

| data_type | Consent Check Location | Test Evidence |
|---|---|---|
| `'BVN'` | `packages/identity` before Prembly call | Test: call `verifyBVN` without consent → error |
| `'NIN'` | `packages/identity` before NIMC call | Test: call `verifyNIN` without consent → error |
| `'phone'` | `packages/contact/src/contact-service.ts::assertChannelConsent` | P12 test in contact service |
| `'whatsapp'` | Same as above | P12 test (whatsapp) |
| `'telegram'` | Same as above | P12 test (telegram) |
| `'email'` | Same as above | P12 test (email) |
| `'account_creation'` | At registration endpoint | Documented in API or auth routes |
| `'community_membership'` | `packages/community/src/membership.ts::joinCommunity` | P10 test in community package |
| `'payment_data'` | Before any Paystack charge call | Documented in payments package or stub |
| `'dm_data'` | At account creation (alongside account_creation consent) | Documented in auth flow |
| `'kyc_data'` | Before any identity verification | Covered by BVN/NIN above |

---

### 6.7 Security Review Document

**File must exist:** `docs/qa/security-review-m7.md`

**Reviewer must verify all 5 security areas are documented with test evidence:**

**A. OTP Replay Prevention**
- Run: `grep "hashed_otp\|hashOTP\|hash.*otp" packages/otp/src/ -r`
- Expected: OTP is hashed before storage. Raw code never in DB.
- Test evidence: test in `packages/otp` that passes hashed value to D1, not raw code

**B. BVN Enumeration Prevention**
- Run: `grep "identityRateLimit" apps/api/src/index.ts`
- Expected: `identityRateLimit` applied to `/identity/verify-bvn` and `/identity/verify-nin`
- Run: `grep "maskPII\|maskPhone\|LOG_PII_SALT" apps/api/src/middleware/audit-log.ts`
- Expected: BVN value is never logged in plaintext

**C. DM Encryption**
- Run: `grep "assertDMMasterKey" apps/api/src/index.ts`
- Expected: one match before any route registration
- Run: `grep "DM_MASTER_KEY" packages/social/src/dm.ts`
- Expected: key used in AES-GCM encryption before every INSERT

**D. Tenant Isolation (T3 — new files only)**
- Run against new M7e/M7f files:
```bash
grep -n "SELECT\|INSERT\|UPDATE\|DELETE" apps/api/src/routes/airtime.ts \
  apps/api/src/routes/geography.ts \
  packages/contact/src/contact-service.ts \
  apps/ussd-gateway/src/telegram.ts \
  2>/dev/null | grep -v "tenant_id\|T3.*exception\|#"
```
- Expected: zero hits (or only geography.ts with T3 exception documented)

**E. CORS Configuration**
- Run: `grep "origin\|ALLOWED_ORIGINS" apps/api/src/index.ts`
- Expected: `ALLOWED_ORIGINS` env-driven, not `'*'`
- Confirm: no wildcard `origin: '*'` in production path

---

## 7. Regression Checks — M7a/M7b/M7c Must Not Break

These checks confirm M7e/M7f changes have not introduced regressions in earlier milestones.

| Package | Regression Command | Expected |
|---|---|---|
| `@webwaka/community` | `pnpm --filter @webwaka/community test` | 45/45 pass |
| `@webwaka/social` | `pnpm --filter @webwaka/social test` | 42/42 pass |
| `@webwaka/offline-sync` | `pnpm --filter @webwaka/offline-sync test` | 29/29 pass |
| `@webwaka/pos` | `pnpm --filter @webwaka/pos test` | 17/17 pass |
| `@webwaka/identity` | `pnpm --filter @webwaka/identity test` | 25/25 pass |
| `@webwaka/otp` | `pnpm --filter @webwaka/otp test` | ≥ 26/26 pass (may increase with 360dialog tests) |
| `apps/api` | `pnpm --filter @webwaka/api test` | ≥ 144/144 pass |
| `apps/ussd-gateway` | `pnpm --filter @webwaka/ussd-gateway test` | ≥ 85/85 pass |

**P14 regression guard (contact.ts refactor must not break DM):**
```bash
grep "assertDMMasterKey" apps/api/src/index.ts
# Must still be called — contact.ts refactor must not touch this
```

**P15 regression guard (community/social moderation must not change):**
```bash
grep "classifyContent" packages/community/src/channel.ts packages/social/src/social-post.ts
# Both files must still call classifyContent
```

---

## 8. QA Gate Blocker Criteria

A PR is **blocked from merge** if ANY of the following are true:

| Blocker | Check |
|---|---|
| `pnpm -r test` has ❌ failures | Any test fails — zero failures allowed |
| `pnpm -r typecheck` has errors | Any TypeScript error — zero errors allowed |
| `assertChannelConsent()` does not throw on missing consent | P12 invariant violated |
| `assertPrimaryPhoneVerified()` does not throw without verified SMS | P13 invariant violated |
| `routeOTPByPurpose('transaction', 'telegram')` routes via Telegram | R8 invariant violated |
| `amount_kobo: 5.5` on airtime route returns 200 | T4 floating-point money violation |
| Raw OTP code found in D1 storage (not hashed) | R7 PII violation |
| DM content found in plaintext in D1 | P14 encryption violation |
| SQL query in new files missing `tenant_id` (except geography) | T3 tenant isolation violation |
| `packages/contact` imports from `packages/auth` or vice versa | Circular dependency |

---

## 9. Issue Reporting Format

For each issue found during QA, create a GitHub issue at `https://github.com/WebWakaDOS/webwaka-os/issues` with:

```
Title: [M7e/M7f/QA-Gate][SEVERITY] Short description

## Invariant / Rule Violated
(P2, P6, P9, P10, P12, P13, P14, P15, R8, T2, T3, T4, or None)

## Phase
[ ] M7e — Nigeria UX Polish
[ ] M7f — Multi-Channel Contact
[ ] M7 QA Gate

## Steps to Reproduce
1. ...
2. ...

## Expected
...

## Actual
...

## Suggested Fix
(Optional — include if obvious)

## Files
- path/to/file.ts:line
```

**Severity levels:**
- **P0** — Platform invariant violated (P12, P13, P14, T3, T4, R8), data exposure risk, or data corruption. Blocks merge. Must fix immediately.
- **P1** — Route returns wrong status code, test failure, missing test coverage for a required scenario, or type error. Blocks merge.
- **P2** — Non-critical behaviour, cosmetic, documentation gap, or advisory. Does not block merge but must be tracked.

---

## 10. Final Approval Criteria

The QA agent signs `/approve-m7ef` only when ALL of the following pass:

```
[ ] pnpm -r test — all tests green, platform total ≥ 652
[ ] pnpm -r typecheck — 0 TypeScript errors
[ ] P12 invariant test passes (assertChannelConsent throws on missing consent)
[ ] P13 invariant test passes (assertPrimaryPhoneVerified throws without SMS)
[ ] R8 invariant test passes (transaction OTP cannot route via Telegram)
[ ] T4 invariant test passes (airtime rejects float amount_kobo)
[ ] T3 audit: no new SQL queries missing tenant_id (except geography, documented)
[ ] Migration 0035 present and correct
[ ] ContactService fully exported from packages/contact
[ ] Telegram webhook handler present in apps/ussd-gateway
[ ] Float ledger reconciliation test present (3 scenarios)
[ ] NITDA self-assessment document present (all 12 provisions)
[ ] CBN KYC audit document present (all 4 tiers)
[ ] NDPR consent audit document present (all 11 data_types)
[ ] Security review document present (5 security areas)
[ ] Lighthouse PWA score ≥ 80 documented
[ ] 0 regressions in M7a/M7b/M7c packages (all 609 baseline tests still green)
```

---

## Source Documents

| Document | Path |
|---|---|
| Implementation Brief (M7e+M7f) | `docs/milestones/m7ef-replit-brief.md` |
| Multi-Channel Contact Model | `docs/contact/multi-channel-model.md` |
| Contact Verification | `docs/contact/contact-verification.md` |
| OTP Routing | `docs/contact/otp-routing.md` |
| OTP Channels (providers) | `docs/identity/otp-channels.md` |
| DM Privacy + Encryption | `docs/social/dm-privacy.md` |
| Platform Invariants | `docs/governance/platform-invariants.md` |
| Security Baseline | `docs/governance/security-baseline.md` |
| NDPR Consent Spec | `docs/enhancements/m7/ndpr-consent.md` |
| CBN KYC Tiers | `docs/enhancements/m7/kyc-compliance.md` |
| Milestone Tracker | `docs/governance/milestone-tracker.md` |
| M7c QA Brief (format reference) | `docs/qa/m7c-qa-brief.md` |
| M7b QA Report (format reference) | `docs/qa/m7b-qa-report.md` |
| M7a QA Report (format reference) | `docs/qa/m7a-qa-report.md` |
| M7b Brief (format reference) | `docs/milestones/m7b-replit-brief.md` |

---

*Brief prepared by Replit QA Agent*
*2026-04-08 — WebWaka OS M7e + M7f + M7 QA Gate*
