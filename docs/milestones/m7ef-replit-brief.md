# WebWaka OS — M7e + M7f + M7 QA Gate Replit Brief

**Prepared by:** Replit QA Agent
**Date:** 2026-04-08
**Phase:** M7e (Nigeria UX Polish) + M7f (Multi-Channel Contact Full Implementation) + M7 QA Launch Gate
**Estimated timeline:** 7 days (M7e: 2 days · M7f: 3 days · M7 QA Gate: 2 days)
**Status:** ACTIVE — M7c merged 2026-04-08, 609 total tests passing, HEAD `4f56ebf`

---

## Context

M7c (combined with M7d per the replit brief) delivered the full Community Platform + Social Network stack:

- **9 D1 migrations** (0026–0034) — community_spaces, memberships, channels, courses, events, moderation_log, social_profiles, social_posts+groups, dm_threads+messages, feed_meta
- **`@webwaka/community`** — 45/45 tests — CommunitySpace, Membership (P10 NDPR), Channel (P15 moderation-first), Course, Event (T4 kobo), moderation classifier bridge
- **`@webwaka/social`** — 42/42 tests — SocialProfile, Follow (self-follow guard), Post (P15), Feed, DM (P14 AES-256-GCM), Story (24h TTL), Groups, Blocks
- **`apps/api`** — 144/144 tests — community.ts (13 routes) + social.ts (11+ routes), wired in index.ts
- **`apps/ussd-gateway`** — 85/85 tests — Branch 3 (trending FSM) + Branch 5 (community FSM)
- **`packages/offline-sync`** — 29/29 tests — Dexie v2 with `feedCache` + `courseContent` tables
- **Total platform tests: 609** — exceeds the 500+ stretch target

M7e now delivers **Nigeria-specific UX polish** (airtime top-up, LGA selector, Naija Pidgin locale, low-data mode).
M7f delivers **full multi-channel contact implementation** with D1 persistence, Telegram Bot handshake, and complete OTP routing.
The **M7 QA Gate** validates all phases together and produces the compliance documentation required for launch.

---

## Repo State You Are Starting From

**Branch:** create `feat/m7ef-nigeria-ux-contact` from current `main`
**Main HEAD:** `4f56ebf`

**Do NOT push directly to `main`.** Open PR: `feat/m7ef-nigeria-ux-contact` → `main`.

### Existing packages to extend (do NOT recreate):
| Package | Current State | M7e/M7f Work Required |
|---|---|---|
| `packages/contact` | Types + normalization + routing utilities only — no D1 persistence | M7f: Add `ContactService` with D1 write methods, P12/P13 guards |
| `packages/otp` | SMS (Termii) + WhatsApp (Meta/Termii) + Telegram providers implemented | M7f: Extend WhatsApp to support 360dialog; wire Telegram chat_id update |
| `packages/frontend` | Tenant manifest + profile renderer + admin layout | M7e: Add `pcm` locale strings, `formatUSSDShortcode()`, `LowDataModeHelper` |
| `packages/geography` | Full Nigeria geography (LGAs, States, Zones) — data seeded | M7e: Expose `GET /geography/lgas?stateId=` and `GET /geography/states` API routes |
| `apps/api` | 9 route files, auth/audit/rate-limit middleware — community + social routes wired | M7e: Add `/airtime/topup`, `/geography/*` routes; M7f: refactor contact routes |
| `apps/ussd-gateway` | 5-branch USSD FSM with D1 pre-fetches | M7f: Add Telegram Bot webhook endpoint |

---

## M7e + M7f + QA Gate Non-Negotiable Platform Invariants

These are the invariants this phase must enforce. Violations are **P0 blocking bugs**.

| Invariant | Phase | Rule |
|---|---|---|
| P2 — Nigeria First | M7e | Airtime top-up is Nigeria-first: Naira kobo only, Nigerian telco prefixes validated |
| P4 — Mobile First | M7e | All new UI helpers verified at 360px viewport minimum |
| P5 — PWA First | M7 QA Gate | Lighthouse PWA score ≥ 80 on all customer-facing apps |
| P6 — Offline First | M7e | Low-data mode strips media_urls but preserves text content — never drops records |
| P7 — Vendor Neutral AI | ALL | No direct OpenAI/Anthropic SDK imports. AI calls via `@webwaka/ai-abstraction` only |
| P9 — Float Integrity | M7e | Airtime amounts stored as integer kobo (NGN×100). No floats. |
| P10 — NDPR Consent | M7f | Consent record required before every outbound OTP send per channel type |
| P11 — Sync FIFO | M7f | Contact channel updates made offline queue through Dexie.js, not direct write |
| P12 — Multi-Channel Consent | M7f | `contact_channels` row may not be used for outbound OTP without consent_records entry |
| P13 — Primary Phone Mandatory | M7f | Every entity initiating KYC/financial op must have `primary_phone` verified = 1 |
| T1 — Cloudflare-First | ALL | All new Workers code. No Node.js HTTP in production path |
| T2 — TypeScript-First | ALL | Strict mode. No `any` without comment. Zero typecheck errors across workspace |
| T3 — Tenant Isolation | ALL | Every D1 query includes `tenant_id` predicate. Every KV key prefixed `tenant:{id}:` |
| T4 — Monetary Integrity | M7e | `amount_kobo` in airtime top-up. Integer only. Never floats. |
| T5 — Subscription-Gated | ALL | All feature access via `@packages/entitlements`. No hardcoded plan checks |
| T8 — Step-by-Step Commits | ALL | Small coherent commits per feature. No mega-commits |
| T10 — Continuity-Friendly | ALL | Inline comments on all non-obvious logic |

---

## Deliverable 1 — M7e: Nigeria UX Polish

### 1a — Airtime Top-Up API

**Purpose:** Allow users to top up their own or another Nigerian mobile number via the platform, using Termii's Airtime API. Charged to the user's wallet (agent float ledger) or card via Paystack.

**New route file:** `apps/api/src/routes/airtime.ts`

**Migration needed:** None — uses existing `float_ledger` and `agent_wallets` tables (0024).

**Endpoint:**
```
POST /airtime/topup
Auth: required (JWT — all tiers)
Body: { phone: string; amount_kobo: number; network?: string; }
Response: 200 { transactionId, phone, amount_kobo, network, status }
Errors: 400 (invalid phone/amount), 402 (insufficient float), 422 (invalid network), 429 (rate limited)
```

**Key implementation rules:**
1. Validate `phone` with `validateNigerianPhone()` from `@webwaka/otp`. Must be valid E.164 Nigerian number.
2. Validate `amount_kobo` with `assertIntegerKobo()` — must be a positive integer (min 5000 kobo = ₦50, max 2,000,000 kobo = ₦20,000 per top-up).
3. Call Termii Airtime API: `POST https://api.ng.termii.com/api/topup` with `{ api_key, ported_number: true, network, amount }`. Amount is passed as naira (kobo ÷ 100) to Termii but stored internally as kobo.
4. On Termii success: deduct from agent float via `postLedgerEntry(db, { amountKobo: -amount_kobo, transactionType: 'cash_out', reference: termii_ref })`.
5. Enforce T3: all queries bind `tenantId` from `auth.tenantId`.
6. Enforce T4: `amount_kobo` is integer. Never call `toFixed()` or `parseFloat()` on monetary values.
7. Rate limit: 5 airtime top-ups per user per hour (KV key: `rate:airtime:{userId}`).
8. CBN KYC gate: minimum KYC Tier 1 required via `requireKYCTier(ctx, 1)` from `@webwaka/entitlements`.

**Nigerian network detection (auto-detect from prefix if `network` not supplied):**
```typescript
// packages/otp/src/phone-validator.ts already has carrier detection — use it
// MTN: 0803, 0806, 0703, 0803, 0806, 0813, 0814, 0816, 0903, 0906, 0913, 0916
// Airtel: 0802, 0808, 0812, 0701, 0708, 0902, 0907, 0912
// Glo: 0805, 0807, 0815, 0905, 0811
// 9mobile: 0809, 0817, 0818, 0908, 0909
// Map to Termii network slugs: 'MTN' | 'Airtel' | 'Glo' | '9mobile'
```

**Environment secrets required (must exist in `apps/api` wrangler.toml bindings):**
- `TERMII_API_KEY` — already present from M7a. No new secret needed.

**New file:** `apps/api/src/routes/airtime.ts`
**Update:** `apps/api/src/index.ts` — wire airtime route + auth middleware + rate limit

**Tests required (`apps/api/src/routes/airtime.test.ts` — minimum 8 tests):**
- `POST /airtime/topup` — 200 with valid Nigerian MTN number and valid kobo amount
- `POST /airtime/topup` — 400 when phone is invalid (non-Nigerian number)
- `POST /airtime/topup` — 422 when amount_kobo is a float (5.5)
- `POST /airtime/topup` — 422 when amount_kobo is below minimum (4000 kobo)
- `POST /airtime/topup` — 401 without JWT
- `POST /airtime/topup` — 429 when rate limit exceeded (mock KV exhausted)
- `POST /airtime/topup` — 402 when agent float insufficient
- `POST /airtime/topup` — 200 with Airtel number — network auto-detected

---

### 1b — LGA Selector API Endpoint

**Purpose:** Expose Nigeria's full geography hierarchy (States, LGAs, Wards) as API endpoints so frontend forms (claim-first onboarding, community space location, profile location) can render a cascading LGA selector without bundling 2000+ LGA names into the client.

`packages/geography` already contains the full Nigeria geography data. These are new **API routes** only — no new package code needed.

**New routes:** `apps/api/src/routes/geography.ts`

```
GET /geography/states
  → No auth required (public, cacheable)
  → Returns: [{ id, name, slug, zone_id, zone_name }]
  → Cache-Control: public, max-age=86400

GET /geography/lgas?stateId={id}
  → No auth required (public, cacheable per stateId)
  → Returns: [{ id, name, slug, state_id }]
  → Cache-Control: public, max-age=86400

GET /geography/wards?lgaId={id}
  → No auth required (public, cacheable per lgaId)
  → Returns: [{ id, name, slug, lga_id }]
  → Cache-Control: public, max-age=86400
```

**Key implementation rules:**
1. T3: These are public routes — no `tenant_id` filter needed (geography is platform-wide, not tenant-scoped). This is a **documented exception** to T3 — geography is a shared lookup table.
2. Queries must use `LIMIT 500` and `OFFSET` to prevent oversized responses (some states have 100+ LGAs, some LGAs have 50+ wards).
3. Set `Cache-Control: public, max-age=86400` on all geography responses (data changes rarely).
4. The `?stateId` parameter is validated as a non-empty string before use in query binding.

**Update:** `apps/api/src/index.ts` — wire geography routes (no auth required — public routes).

**Tests required (`apps/api/src/routes/geography.test.ts` — minimum 5 tests):**
- `GET /geography/states` — 200 with array of states
- `GET /geography/lgas?stateId=lagos_id` — 200 with LGAs for Lagos
- `GET /geography/lgas` without `stateId` — 400 bad request
- `GET /geography/wards?lgaId=ikeja_id` — 200 with wards for Ikeja
- `GET /geography/wards` without `lgaId` — 400 bad request

---

### 1c — Naija Pidgin (pcm) Locale Strings

**Purpose:** Provide i18next-compatible key-value locale strings for Naija Pidgin (ISO 639-3: `pcm`) so any frontend app using `@webwaka/frontend` can render UI in Pidgin alongside English.

**New file:** `packages/frontend/src/i18n/pcm.ts`

**Format:** Plain TypeScript object (not JSON, to keep TypeScript strict mode and allow comments):

```typescript
/**
 * Naija Pidgin (pcm) locale strings — i18next compatible.
 * ISO 639-3: pcm — Nigerian Pidgin
 *
 * Scope: Core platform UI strings used across all verticals.
 * Extended locale strings live in each vertical package (community, social, etc.)
 *
 * Guidelines:
 * - Use standard Naija Pidgin as spoken in Lagos, Warri, Port Harcourt, Abuja.
 * - Avoid Yoruba/Igbo/Hausa-specific words unless they are pan-Nigeria common.
 * - Tech terms (OTP, BVN, NIN) remain in English — they are widely understood.
 * - Monetary values always display as ₦ (Naira) never "dollar" or "pounds".
 */
export const pcmLocale: Record<string, string> = {
  // --- Navigation ---
  'nav.home': 'Home',
  'nav.discover': 'Find Tings',
  'nav.community': 'Community',
  'nav.wallet': 'My Wallet',
  'nav.profile': 'My Profile',

  // --- Auth ---
  'auth.login': 'Enter',
  'auth.logout': 'Comot',
  'auth.register': 'Join Up',
  'auth.phone_label': 'Your Phone Number',
  'auth.otp_prompt': 'Enter di code wey we send to your phone',
  'auth.otp_resend': 'Send code again',
  'auth.otp_resend_wait': 'Wait {{seconds}} seconds before you try again',
  'auth.kyc_required': 'You need to verify your details first',
  'auth.bvn_consent': 'Abeg, make we confirm your BVN make your account work well',

  // --- Wallet ---
  'wallet.balance': 'Your balance na ₦{{amount}}',
  'wallet.topup': 'Add Money',
  'wallet.send': 'Send Money',
  'wallet.history': 'Your Transactions',
  'wallet.airtime': 'Buy Airtime',
  'wallet.airtime_amount': 'How much airtime you want?',
  'wallet.insufficient': 'Oga, your balance no reach. Add money first.',
  'wallet.success': 'Transaction don go through! ₦{{amount}}',
  'wallet.failed': 'Transaction fail. Try again.',

  // --- Community ---
  'community.join': 'Join Community',
  'community.leave': 'Leave Community',
  'community.join_success': 'You don join! Welcome to {{name}}',
  'community.post_placeholder': 'Wetin dey your mind? Share with di community...',
  'community.reply': 'Reply',
  'community.course_locked': 'You need to upgrade your membership to see this course',
  'community.event_rsvp': 'I go attend',
  'community.event_rsvp_maybe': 'Maybe I go come',

  // --- Social ---
  'social.post_placeholder': 'Wetin dey happen? Tell us...',
  'social.follow': 'Follow',
  'social.unfollow': 'Unfollow',
  'social.followers': '{{count}} Followers',
  'social.following': 'Following {{count}}',
  'social.dm': 'Send Message',
  'social.story_expired': 'Dis story don expire',
  'social.report': 'Report dis post',

  // --- KYC ---
  'kyc.tier0': 'You never verify your account',
  'kyc.tier1': 'Your phone don verify',
  'kyc.tier2': 'Your BVN don verify',
  'kyc.tier3': 'Account fully verified',
  'kyc.upgrade_prompt': 'Verify your {{document}} make you fit do more tings',

  // --- NDPR Consent ---
  'consent.title': 'We need your permission',
  'consent.body': 'Make we use your {{dataType}} to {{purpose}}. You fit change your mind anytime.',
  'consent.agree': 'I agree',
  'consent.decline': 'No, I no agree',

  // --- Errors ---
  'error.network': 'Network wahala. Check your connection.',
  'error.server': 'Something do. Try again small time.',
  'error.not_found': 'We no see wetin you dey find.',
  'error.unauthorized': 'You no get permission for dis one.',
  'error.rate_limited': 'You don try too many times. Rest small, then try again.',

  // --- USSD ---
  'ussd.shortcode': 'Dial {{code}} from any phone to access WebWaka without data',
  'ussd.no_data_needed': 'No data needed',

  // --- PWA ---
  'pwa.install_prompt': 'Add WebWaka to your home screen for faster access — no data needed once installed',
  'pwa.offline_banner': 'You dey offline. Some tings no go work, but you fit still read your saved content.',
  'pwa.sync_pending': '{{count}} updates dey wait to sync when you get data back.',
};
```

**Also add English (`en`) locale as the baseline reference:**

**New file:** `packages/frontend/src/i18n/en.ts` — same key structure as `pcm.ts` but in standard English.

**New file:** `packages/frontend/src/i18n/index.ts` — exports both locales and a type-safe lookup:
```typescript
export { pcmLocale } from './pcm.js';
export { enLocale } from './en.js';
export type { LocaleKey } from './types.js'; // keyof typeof enLocale
```

**Update:** `packages/frontend/src/index.ts` — re-export i18n module.

**Tests required (`packages/frontend/src/i18n.test.ts` — minimum 4 tests):**
- `pcmLocale` contains all keys from `enLocale` (no missing keys)
- `pcmLocale['auth.login']` returns 'Enter' (Pidgin smoke test)
- `pcmLocale['wallet.balance']` contains `₦{{amount}}` template token
- `enLocale['wallet.balance']` contains `₦{{amount}}` matching pcm structure

---

### 1d — Low-Data Mode Middleware

**Purpose:** When a client sends `X-Low-Data: 1` request header, strip `media_urls` arrays from API responses to minimise data usage for low-bandwidth Nigerian users. Text content is never stripped.

**New file:** `apps/api/src/middleware/low-data.ts`

```typescript
/**
 * Low-data mode middleware (M7e, Platform Invariant P4/P6)
 *
 * When request header X-Low-Data: 1 is present, recursively strip
 * all `media_urls` arrays from JSON response bodies.
 *
 * P6: Text content is NEVER stripped — only media arrays.
 * Only applies to JSON responses. Binary/text responses pass through.
 */
import type { MiddlewareHandler } from 'hono';

export const lowDataMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  if (c.req.header('X-Low-Data') !== '1') return;

  const contentType = c.res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) return;

  try {
    const body = await c.res.clone().json<Record<string, unknown>>();
    const stripped = stripMediaUrls(body);
    c.res = new Response(JSON.stringify(stripped), {
      status: c.res.status,
      headers: c.res.headers,
    });
  } catch {
    // Non-parseable response — pass through unchanged
  }
};

function stripMediaUrls(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripMediaUrls);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = key === 'media_urls' ? [] : stripMediaUrls(val);
    }
    return result;
  }
  return obj;
}
```

**Update:** `apps/api/src/index.ts` — register `lowDataMiddleware` globally AFTER auth middleware (so auth still works normally).

**Tests required (added to `apps/api` test suite — minimum 3 tests):**
- Without `X-Low-Data: 1` — response includes `media_urls` normally
- With `X-Low-Data: 1` — response has `media_urls` replaced with `[]`
- With `X-Low-Data: 1` on non-JSON response — response passes through unchanged

---

### 1e — USSD Shortcode Display Utility

**Purpose:** Standardise the display of the `*384#` shortcode in UI components. Single source of truth so NCC registration updates only one place.

**Update file:** `packages/frontend/src/index.ts` (add export)

**New file:** `packages/frontend/src/ussd-shortcode.ts`

```typescript
/**
 * USSD shortcode constants and display helpers (M7e).
 * NCC registration pending — do not hardcode shortcode outside this file.
 *
 * @see docs/governance/milestone-tracker.md — M7 QA Gate: NCC *384# registration
 */

export const USSD_SHORTCODE = '*384#' as const;
export const USSD_SHORTCODE_DISPLAY = '*384#';

/**
 * Returns localised text for USSD shortcode prompt.
 * Usage: <span>{formatUSSDPrompt()}</span>
 */
export function formatUSSDPrompt(
  locale: 'en' | 'pcm' = 'en',
): string {
  if (locale === 'pcm') {
    return `Dial ${USSD_SHORTCODE} from any phone — even without data`;
  }
  return `Dial ${USSD_SHORTCODE} from any phone — no data required`;
}

/**
 * Returns a tel: link that opens the USSD dialler on mobile.
 * Safe to use in <a href> — encodes the * and # correctly.
 */
export function getUSSDDialLink(): string {
  return `tel:${encodeURIComponent(USSD_SHORTCODE)}`;
}
```

**Tests required (minimum 3 tests):**
- `USSD_SHORTCODE === '*384#'`
- `formatUSSDPrompt('en')` contains `*384#`
- `formatUSSDPrompt('pcm')` contains `*384#` and Pidgin text
- `getUSSDDialLink()` returns a `tel:` URI

---

### 1f — Lighthouse PWA Audit (M7e QA Gate prerequisite)

The M7 QA Gate requires Lighthouse PWA score ≥ 80 on all customer-facing apps. The `apps/platform-admin` is currently the only running app (port 5000). The following files must be present in the app:

**Files to add/update in `apps/platform-admin/`:**

1. **`public/manifest.json`** — standard PWA manifest:
```json
{
  "name": "WebWaka OS",
  "short_name": "WebWaka",
  "description": "Nigeria's multi-vertical digital operating system",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#006400",
  "lang": "en-NG",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

2. **`public/sw.js`** — minimal service worker that caches the app shell:
```javascript
const CACHE = 'webwaka-v1';
const SHELL = ['/', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
```

3. **`server.js`** update — add `Link: </manifest.json>; rel=manifest` header and `Content-Security-Policy` headers.

---

## Deliverable 2 — M7f: Multi-Channel Contact Full Implementation

### Overview of Current State vs M7f Target

| Component | M7a State (done) | M7f Target |
|---|---|---|
| `contact_channels` table (0018) | Multi-row schema: one row per channel per user | Add `telegram_chat_id` column via migration 0035 |
| `contact_preferences` table (0021) | `otp_preference` + `notification_preference` per user | Already complete — no change needed |
| `packages/contact` | Types + normalization + routing utilities (no D1 writes) | Add `ContactService` with full D1 persistence + P12/P13 guards |
| `apps/api/src/routes/contact.ts` | Inline D1 queries — correct but not shared | Refactor: extract D1 logic into `ContactService`; routes become thin wrappers |
| Telegram Bot webhook | Not implemented | New endpoint in `apps/ussd-gateway` |
| WhatsApp Business | Termii WA gateway (M7a) | Extend to also support 360dialog as alternate provider |
| OTP routing algorithm | `channel-resolver.ts` — preference + fallback (M7a) | Extend with purpose-specific routing: transaction OTP → SMS only (R8) |
| P12 consent check | Manual in routes (partial) | `ContactService.assertChannelConsent()` called before every OTP dispatch |
| P13 primary phone guard | `PUT /contact/channels` checks `primary_phone` presence | `ContactService.assertPrimaryPhoneVerified()` + `packages/auth/src/guards.ts` integration |

---

### 2a — Migration 0035: Add `telegram_chat_id` to `contact_channels`

The `telegram_chat_id` is populated by the Telegram Bot webhook after handshake — it is the Telegram internal chat ID needed to send messages to the user. It was not included in the M7a migration 0018.

**New file:** `infra/db/migrations/0035_contact_telegram_chat_id.sql`

```sql
-- Migration: 0035_contact_telegram_chat_id
-- Description: Add telegram_chat_id column to contact_channels for Telegram Bot handshake (M7f).
-- The chat_id is populated server-side when user starts @WebWakaBot — never client-supplied.
-- (docs/contact/contact-verification.md — Telegram Verification Flow)

ALTER TABLE contact_channels ADD COLUMN telegram_chat_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contact_telegram_chat_id
  ON contact_channels(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;
```

> **Note:** This is an `ALTER TABLE ADD COLUMN` — safe and idempotent on D1. The column is nullable so existing rows are unaffected.

---

### 2b — `packages/contact/src/contact-service.ts` — Full ContactService with D1 Persistence

**Purpose:** Centralise all D1 persistence for contact channels in the package. Routes become thin wrappers. This enables other packages (community, social, identity) to import ContactService without depending on the API app.

**New file:** `packages/contact/src/contact-service.ts`

**Key type (define locally — do not import from external packages):**
```typescript
interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}
```

**Function signatures to implement:**

```typescript
/**
 * Upsert contact channel rows for a user.
 * Uses DELETE + INSERT strategy per channel_type to handle value changes.
 * T3: all queries bind tenantId.
 */
export async function upsertContactChannels(
  db: D1Like,
  userId: string,
  channels: readonly ContactChannelInput[],
  tenantId: string,
): Promise<void>

/**
 * Retrieve all contact channel rows for a user.
 * Returns ordered: primary first, then by channel_type.
 */
export async function getContactChannels(
  db: D1Like,
  userId: string,
  tenantId: string,
): Promise<ContactChannelRecord[]>

/**
 * Mark a specific channel as verified.
 * Sets verified = 1 and verified_at = unixepoch().
 * R10: Each channel is independently verified.
 */
export async function markChannelVerified(
  db: D1Like,
  userId: string,
  channelType: 'sms' | 'whatsapp' | 'telegram' | 'email',
  tenantId: string,
): Promise<void>

/**
 * Update telegram_chat_id after Telegram Bot handshake.
 * This is set server-side from the bot webhook — never from client.
 */
export async function updateTelegramChatId(
  db: D1Like,
  userId: string,
  chatId: string,
  tenantId: string,
): Promise<void>

/**
 * Remove an optional channel (non-primary SMS).
 * P13: Cannot remove primary SMS channel — throws ContactError.
 */
export async function removeContactChannel(
  db: D1Like,
  userId: string,
  channelType: 'whatsapp' | 'telegram' | 'email',
  tenantId: string,
): Promise<void>

/**
 * P12 — NDPR multi-channel consent enforcement.
 * Asserts consent_records row exists for this user + data_type before OTP dispatch.
 * data_type mapping: sms→'phone', whatsapp→'whatsapp', telegram→'telegram', email→'email'
 * Throws ContactError('CONSENT_REQUIRED') if no active consent.
 */
export async function assertChannelConsent(
  db: D1Like,
  userId: string,
  channelType: 'sms' | 'whatsapp' | 'telegram' | 'email',
  tenantId: string,
): Promise<void>

/**
 * P13 — Primary phone mandatory guard.
 * Asserts that the user has a verified primary SMS channel.
 * Called before any KYC uplift or financial operation.
 * Throws ContactError('PRIMARY_PHONE_REQUIRED') if not verified.
 */
export async function assertPrimaryPhoneVerified(
  db: D1Like,
  userId: string,
  tenantId: string,
): Promise<void>
```

**Error class to export from `packages/contact/src/contact-service.ts`:**
```typescript
export class ContactError extends Error {
  constructor(
    public readonly code:
      | 'CONSENT_REQUIRED'
      | 'PRIMARY_PHONE_REQUIRED'
      | 'CHANNEL_NOT_FOUND'
      | 'CANNOT_REMOVE_PRIMARY',
    message: string,
  ) {
    super(message);
    this.name = 'ContactError';
  }
}
```

**Update `packages/contact/src/index.ts`** — re-export all from `contact-service.ts`.

---

### 2c — Refactor `apps/api/src/routes/contact.ts` to Use ContactService

The existing contact routes have inline D1 queries. Refactor them to delegate to `ContactService`:
- `GET /contact/channels` → `getContactChannels(db, userId, tenantId)`
- `PUT /contact/channels` → `upsertContactChannels(db, userId, channels, tenantId)`
- `POST /contact/verify/:channel` → `assertChannelConsent(db, userId, channel, tenantId)` THEN send OTP
- `POST /contact/confirm/:channel` → `markChannelVerified(db, userId, channel, tenantId)` on success
- `DELETE /contact/channels/:channel` → `removeContactChannel(db, userId, channel, tenantId)`

**Auth/rate-limit middleware remains unchanged.** Only the inline D1 logic moves.

---

### 2d — Telegram Bot Webhook Handler

**Purpose:** Receive Telegram Bot updates (user messages to `@WebWakaBot`). On `/start` command: look up user by Telegram handle, update `telegram_chat_id`.

**Location:** `apps/ussd-gateway/src/telegram.ts` (new file — in the USSD gateway Worker, which already has Telegram env bindings from M7a)

**New route added to `apps/ussd-gateway/src/index.ts`:**
```
POST /telegram/webhook
  Auth: validate X-Telegram-Bot-Api-Secret-Token header
  Body: Telegram Update JSON object
  Response: 200 (always — Telegram requires 200 even on error)
```

**Implementation logic in `apps/ussd-gateway/src/telegram.ts`:**
```typescript
/**
 * Telegram Bot webhook handler (M7f).
 * Handles: /start command → register telegram_chat_id for user
 * Handles: message with OTP verification code → confirmation of OTP
 *
 * Env: TELEGRAM_BOT_TOKEN (Cloudflare Worker secret)
 *      TELEGRAM_WEBHOOK_SECRET (Cloudflare Worker secret — validates X-Telegram-Bot-Api-Secret-Token)
 *      DB (D1Database)
 *
 * Flow for /start:
 *   1. User messages @WebWakaBot with /start
 *   2. Bot extracts chat_id and username from update
 *   3. Look up contact_channels WHERE channel_type='telegram' AND value='@username'
 *   4. If found: UPDATE telegram_chat_id = chat_id, send welcome message
 *   5. If not found: send "Please verify your Telegram handle in the WebWaka app first"
 *
 * Uses Telegram Bot API directly (fetch). No third-party Telegram SDK (T1/T2 compliance).
 */

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; first_name: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

export async function handleTelegramWebhook(
  update: TelegramUpdate,
  env: { DB: D1Database; TELEGRAM_BOT_TOKEN: string },
): Promise<void>

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  botToken: string,
): Promise<void>
```

**Env secrets required in `apps/ussd-gateway/wrangler.toml`:**
```toml
[vars]
# Non-secret only — secrets go via wrangler secret put
TELEGRAM_WEBHOOK_SECRET = ""  # Placeholder — set via wrangler secret put
```

Secrets (set via `wrangler secret put`):
- `TELEGRAM_BOT_TOKEN` — already in M7a for `@webwaka/otp/src/telegram-bot.ts`
- `TELEGRAM_WEBHOOK_SECRET` — new. Random string to validate Telegram webhook calls.

**Tests required (`apps/ussd-gateway/src/telegram.test.ts` — minimum 5 tests):**
- Valid `/start` update from known Telegram handle → updates `telegram_chat_id`
- Valid `/start` update from unknown handle → sends "not registered" reply
- Update with non-`/start` text → gracefully ignored (200 response)
- Invalid `X-Telegram-Bot-Api-Secret-Token` header → 403
- Missing `message` field in update body → 200 (graceful empty handling)

---

### 2e — WhatsApp Business API: 360dialog Support

**Purpose:** Add 360dialog as an alternative WhatsApp provider alongside the existing Termii WA gateway. Provider is selected via `WHATSAPP_PROVIDER` env var (`'termii'` | `'360dialog'`).

**Update file:** `packages/otp/src/whatsapp-meta.ts`

Add a `sendWhatsAppOTP360dialog()` internal function:
```typescript
// 360dialog API: POST https://waba.360dialog.io/v1/messages
// Auth: D360-API-KEY header
// Body: { to: "+234...", type: "template", template: { name: "webwaka_otp", language: { code: "en" }, components: [...] } }
```

**Update `packages/otp/src/multi-channel.ts`** — check `env.WHATSAPP_PROVIDER` and route accordingly:
```typescript
if (env.WHATSAPP_PROVIDER === '360dialog') {
  return sendWhatsAppOTP360dialog(phone, otp, env.DIALOG360_API_KEY);
} else {
  return sendWhatsAppOTPTermii(phone, otp, env);  // existing Termii WA path
}
```

**New env var (in `apps/api/src/env.ts`):**
```typescript
WHATSAPP_PROVIDER: '360dialog' | 'termii';  // default: 'termii'
DIALOG360_API_KEY: string;                   // Only required if WHATSAPP_PROVIDER='360dialog'
```

**Tests required (minimum 3 tests in `packages/otp`):**
- `sendWhatsAppOTPTermii()` called when `WHATSAPP_PROVIDER = 'termii'`
- `sendWhatsAppOTP360dialog()` called when `WHATSAPP_PROVIDER = '360dialog'`
- `sendWhatsAppOTP360dialog()` formats payload correctly for 360dialog API spec

---

### 2f — OTP Routing Algorithm: Purpose-Specific Channel Enforcement (R8)

**Purpose:** The existing `channel-resolver.ts` returns a preferred channel but does not enforce Security Rule R8 (transaction OTPs must use SMS — not Telegram). Add purpose-aware routing.

**Update file:** `packages/contact/src/channel-resolver.ts`

**New function:**
```typescript
/**
 * Route OTP delivery channel by purpose.
 * Enforces R8: transaction + kyc_uplift OTPs MUST use SMS (or WhatsApp fallback).
 * Telegram is NOT allowed for transaction or KYC OTPs.
 * 
 * R8 rules:
 *   'verification' → user preference, full waterfall
 *   'login' → user preference, full waterfall
 *   'transaction' → SMS primary → WhatsApp fallback → voice (NO Telegram)
 *   'kyc_uplift' → SMS primary → WhatsApp fallback (NO Telegram, NO voice)
 *   'password_reset' → user preference, SMS/WA/TG allowed
 *
 * Returns ordered array of channels to attempt (try index 0 first).
 * Throws OTPRoutingError if no eligible channel available for purpose.
 */
export function routeOTPByPurpose(
  channels: readonly ContactChannelRecord[],
  purpose: OTPPurpose,
  preference: OTPPreference,
): OTPContactTarget[]

export type OTPPurpose =
  | 'verification'
  | 'login'
  | 'transaction'
  | 'kyc_uplift'
  | 'password_reset';

export class OTPRoutingError extends Error {
  constructor(
    public readonly code: 'NO_ELIGIBLE_CHANNEL' | 'CHANNEL_BLOCKED_FOR_PURPOSE',
    message: string,
  ) {
    super(message);
    this.name = 'OTPRoutingError';
  }
}
```

**Update `packages/contact/src/index.ts`** — re-export `routeOTPByPurpose`, `OTPPurpose`, `OTPRoutingError`.

**Tests required (minimum 5 tests in `packages/contact`):**
- `routeOTPByPurpose(channels, 'transaction', 'sms')` → SMS channel first
- `routeOTPByPurpose(channels, 'transaction', 'telegram')` → SMS (not Telegram — R8)
- `routeOTPByPurpose(channels, 'kyc_uplift', 'telegram')` → SMS fallback (R8)
- `routeOTPByPurpose(channels, 'verification', 'telegram')` → Telegram allowed
- `routeOTPByPurpose([], 'transaction', 'sms')` → throws `OTPRoutingError('NO_ELIGIBLE_CHANNEL')`

---

### 2g — P12/P13 Enforcement in Auth Guards

**Purpose:** P13 (primary phone mandatory) must be enforced in `packages/auth/src/guards.ts` at the KYC tier check point — not only at the contact routes.

**Update file:** `packages/auth/src/guards.ts`

Add `requirePrimaryPhoneVerified()` guard that is called alongside `requireKYCTier()`:
```typescript
/**
 * P13 — Primary phone mandatory guard.
 * Throws AuthError('PRIMARY_PHONE_REQUIRED') if user has no verified primary SMS contact channel.
 * Must be called before any KYC Tier 1+ uplift operation.
 *
 * Implementation: check contact_channels WHERE user_id=? AND channel_type='sms' AND is_primary=1 AND verified=1
 */
export async function requirePrimaryPhoneVerified(
  db: D1Like,
  userId: string,
  tenantId: string,
): Promise<void>
```

**Note:** `packages/auth` must NOT import `packages/contact` (circular dependency risk). Implement the D1 query inline in guards.ts — it's a single SELECT.

---

### 2h — Cross-Vertical Integration Smoke Tests

**Purpose:** Validate that M7a (auth/contact/identity) + M7b (offline-sync/USSD/POS) + M7c (community/social) all work together correctly in the same API Worker. These are full API-level integration tests using mocked D1.

**New file:** `apps/api/src/routes/integration.test.ts`

**Scenarios to test (minimum 6 tests):**
1. **Full join flow:** NDPR consent → `POST /community/join` → `GET /community/:id/channels` — all return correct responses
2. **Auth + contact + community:** Authenticated user with verified primary phone can join paid community (KYC Tier 1)
3. **Auth + contact + social DM:** Authenticated user with DM_MASTER_KEY can send a DM; decrypted content matches
4. **USSD + social:** USSD Branch 3 pre-fetches `social_posts` by `like_count DESC` — returns top 5
5. **Offline-sync + community post:** Create channel post offline (Dexie queue) → sync via `POST /sync/apply` → post appears in `GET /community/channels/:id/posts`
6. **Contact + P12:** `POST /contact/verify/telegram` without consent_records row → 403 `CONSENT_REQUIRED`

---

## Deliverable 3 — M7 QA Launch Gate

All items below must be documented and passing before M7 is declared launch-ready. Items that require external action (NCC registration, NITDA audit) are documented but not blocking CI.

### 3a — TypeScript Strict Typecheck: 0 Errors Across Workspace

**Command:** `pnpm -r typecheck`

Expected output: zero TypeScript errors across all packages and apps. This MUST pass before PR merge.

**Common failure sources to pre-emptively fix:**
- `any` without comment in new M7e/M7f code
- Missing `tenantId` parameter types
- `ContactError` not exported from `packages/contact`
- `OTPRoutingError` not in `packages/contact/src/index.ts`

---

### 3b — NITDA Code of Practice Self-Assessment

**Create:** `docs/qa/nitda-self-assessment.md`

This document must cover all 12 provisions of the NITDA Code of Practice for Interactive Computer Service Platforms (2023):

1. Content moderation policy and enforcement
2. Hate speech and harassment mechanisms
3. User reporting tools
4. Government/law enforcement data request process
5. Transparency reporting (annual)
6. Local content support (Nigerian languages — pcm locale covers this)
7. Data localisation compliance (D1 data centres)
8. Child safety policy
9. Misinformation handling
10. Appeals process for moderation decisions
11. User privacy settings
12. Platform liability framework

Document format:
```
## Provision [N]: [Title]
**Status:** [Compliant / Partially Compliant / Action Required]
**Evidence:** [Where in codebase this is handled]
**Gap (if any):** [What's missing]
**Resolution:** [How to resolve before launch]
```

---

### 3c — CBN KYC Compliance Audit

**Create:** `docs/qa/cbn-kyc-audit.md`

**Audit scope:** All 4 CBN KYC tiers are enforced and tested.

| Tier | Limit | Enforcement Point | Test Coverage |
|---|---|---|---|
| Tier 0 | ₦0 — no transactions | `assertWithinTierLimits()` | `packages/entitlements` tests |
| Tier 1 | ₦50,000/day, ₦300,000/month | `requireKYCTier(ctx, 1)` at payment routes | `apps/api/routes/pos.test.ts` |
| Tier 2 | ₦200,000/day, ₦1M/month | `requireKYCTier(ctx, 2)` at identity routes | `apps/api/routes/identity.test.ts` |
| Tier 3 | Unlimited | `requireKYCTier(ctx, 3)` at large payments | `packages/entitlements/guards.test.ts` |

Audit must include:
- Evidence of KYC tier check at every monetary route
- Test case showing a Tier 0 user is blocked from any transaction
- Test case showing a Tier 2 user is blocked from exceeding ₦200,000/day
- Confirmation that `assertWithinTierLimits()` is called at POS float top-up

---

### 3d — NDPR Consent Records Audit

**Create:** `docs/qa/ndpr-consent-audit.md`

**Audit scope:** All 11+ `data_type` values in `consent_records` are covered and tested.

Required `data_type` values (confirm each has a consent record INSERT test):

| data_type | Purpose | Created At |
|---|---|---|
| `'BVN'` | BVN identity verification | Before `POST /identity/verify-bvn` |
| `'NIN'` | NIN identity verification | Before `POST /identity/verify-nin` |
| `'phone'` | SMS OTP channel | Before first SMS OTP send |
| `'whatsapp'` | WhatsApp OTP channel | Before first WhatsApp OTP send |
| `'telegram'` | Telegram OTP channel | Before first Telegram message |
| `'email'` | Email verification | Before email verification link |
| `'account_creation'` | Platform account creation | At registration |
| `'community_membership'` | Community join | Before `POST /community/join` |
| `'payment_data'` | Payment processing | Before paid tier upgrade |
| `'dm_data'` | DM processing | At account creation |
| `'kyc_data'` | KYC tier upgrade | Before any identity verification |

Audit must confirm:
- Each `data_type` has at least one test verifying the consent check fires before the operation
- The consent UI requirements (plain language, no pre-ticked boxes, purpose-specific) are documented
- Withdrawal flow is documented (how to revoke consent per data_type)

---

### 3e — Security Review Checklist

**Create:** `docs/qa/security-review-m7.md`

Required checks:

**OTP Replay Prevention (R7/R9):**
- OTP codes are SHA-256 hashed before D1 storage — confirm in `packages/otp/src/otp-generator.ts`
- Raw OTP never logged — confirm no `console.log(otp)` in any file
- `otp_log` table uses `hashed_otp` column — confirm in migration 0015
- Rate limit test: simulate 6 OTP requests in 1 hour from same phone → 5th is 429

**BVN Enumeration Prevention (R5/R7):**
- `POST /identity/verify-bvn` has `identityRateLimit` middleware (2/hr per user)
- BVN value is never logged — confirm `maskPII()` is called in audit log
- BVN lookup requires prior consent record — confirm P10 assertion fires first
- Response time is constant regardless of BVN validity (prevent timing attacks — stub delays)

**DM Encryption (P14):**
- `assertDMMasterKey(env.DM_MASTER_KEY)` called at Worker startup
- DM content in D1 is AES-256-GCM ciphertext — never plaintext
- Test: `sendDM()` with undefined DM_MASTER_KEY → throws before any D1 write

**Tenant Isolation (T3):**
- Run `grep -r "SELECT\|INSERT\|UPDATE\|DELETE" packages/ apps/api/src/routes/ | grep -v "tenant_id"` — every non-geography query must include `tenant_id`
- Cross-tenant leakage test: user from tenant A cannot read tenant B's community posts

**CORS Configuration:**
- `ALLOWED_ORIGINS` is not `'*'` in production — confirm in `apps/api/src/index.ts`
- Origin function uses endsWith('.webwaka.com') pattern — confirm test

---

### 3f — Agent Float Ledger Reconciliation Test

**Add to:** `apps/api/src/routes/pos.test.ts`

**New test: "Float ledger reconciliation"**
```
Scenario:
  1. Create agent wallet (balance_kobo = 0)
  2. POST /pos/float/credit 50,000 kobo (reference: 'credit-001') → balance = 50,000
  3. POST /pos/cash-out 20,000 kobo (reference: 'debit-001') → balance = 30,000
  4. POST /pos/float/credit 50,000 kobo (idempotent, same reference: 'credit-001') → balance still 30,000 (no double-credit)
  5. POST /pos/reversal on 'debit-001' (reference: 'reversal-001') → balance = 50,000
  6. GET /pos/float/history → sum of amount_kobo in float_ledger = 50,000 kobo (matches wallet balance)
  7. Attempt negative balance: POST /pos/cash-out 60,000 kobo → 402 InsufficientFloatError

Assertions:
  - running_balance_kobo on every ledger row is consistent (never negative)
  - Idempotent re-send of 'credit-001' produces no duplicate row (UNIQUE reference constraint)
  - float_ledger has 4 rows (credit, debit, reversal, and the idempotent retry which returned existing)
  - Sum of all amount_kobo = final balance_kobo
```

---

## Package Configuration Requirements

### New packages required: NONE
All M7e/M7f work is in existing packages and apps.

### Updated packages:
| Package | Changes |
|---|---|
| `packages/contact` | New `contact-service.ts`, updated `channel-resolver.ts`, updated `index.ts` |
| `packages/otp` | Updated `whatsapp-meta.ts` (360dialog), updated `multi-channel.ts` |
| `packages/auth` | Updated `guards.ts` (P13 primary phone guard) |
| `packages/frontend` | New `i18n/pcm.ts`, `i18n/en.ts`, `i18n/index.ts`, `ussd-shortcode.ts` |
| `apps/api` | New `routes/airtime.ts`, `routes/geography.ts`, `middleware/low-data.ts`; refactored `routes/contact.ts` |
| `apps/ussd-gateway` | New `telegram.ts` |
| `apps/platform-admin` | New `public/manifest.json`, `public/sw.js`, updated `server.js` |
| `infra/db/migrations` | New `0035_contact_telegram_chat_id.sql` |

### vitest.config.ts additions for `apps/api`:
No new package aliases needed — all M7e/M7f packages were already aliased in M7a/M7b.

---

## Environment Secrets Required

All secrets already provisioned from M7a/M7b. No new secrets except:
- `TELEGRAM_WEBHOOK_SECRET` — new. Set via `wrangler secret put TELEGRAM_WEBHOOK_SECRET` in `apps/ussd-gateway`.
- `DIALOG360_API_KEY` — new. Only required if `WHATSAPP_PROVIDER = '360dialog'`. Set via `wrangler secret put DIALOG360_API_KEY` in `apps/api`.

---

## CI Requirements

Every updated package must:
1. Pass `pnpm typecheck` at workspace root — 0 errors
2. Pass `pnpm test` — all new tests green
3. No new `any` types without `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment

The extended `apps/api` must:
1. Pass `pnpm --filter @webwaka/api test` — all 144+ tests green (144 existing + new M7e/M7f tests)
2. Pass `pnpm --filter @webwaka/api typecheck` — 0 errors
3. Integration smoke test added in `integration.test.ts` — all 6 scenarios pass

---

## Test Count Summary

| Package/App | Existing Tests | M7e/M7f New Tests | Target Total |
|---|---|---|---|
| `packages/contact` | 15 | ≥ 10 (ContactService + P12/P13 + OTP routing) | ≥ 25 |
| `packages/otp` | 26 | ≥ 3 (360dialog) | ≥ 29 |
| `packages/auth` | 34 | ≥ 2 (P13 guard) | ≥ 36 |
| `packages/frontend` | 45 | ≥ 7 (locale + USSD shortcode) | ≥ 52 |
| `apps/api` | 144 | ≥ 16 (airtime + geography + low-data + integration) | ≥ 160 |
| `apps/ussd-gateway` | 85 | ≥ 5 (Telegram webhook) | ≥ 90 |
| QA Gate tests (pos reconciliation) | existing | ≥ 3 | — |
| **New tests total** | — | **≥ 46** | — |
| **Platform total** | **609** | **≥ 46** | **≥ 655** |

---

## Non-Deliverables (Do NOT Implement)

- **No E2EE (Signal Protocol)** — platform-side AES-256-GCM is correct for M7; E2EE is M8+
- **No Zoom/Google Meet integration** — event location is a URL field; no SDK integration for M7
- **No push notifications** — Web Push via Service Worker is optional PWA enhancement, not required for PWA score ≥ 80
- **No Paystack subscription billing for community tiers** — data model is complete; charging flow integration deferred to M8 vertical modules
- **No full i18next framework** — `packages/frontend/src/i18n/pcm.ts` is a plain TypeScript object; runtime i18next integration is M8 frontend work
- **No NCC `*384#` registration** — this is a government submission, not code. Document it in QA Gate but do not block CI on it.
- **No changes to platform-invariants.md** — P12/P13 already documented there. No new invariants in M7e/M7f.
- **No video lesson upload to R2** — `content_type='video'` models the field; upload requires R2 signed URLs, deferred to M8

---

## PR Instructions

**Branch:** `feat/m7ef-nigeria-ux-contact`
**Base:** `main`
**Title:** `feat(m7ef): Nigeria UX Polish (airtime, LGA, Pidgin, low-data) + Full Multi-Channel Contact + M7 QA Gate`

**PR Description must include:**
- Summary of all 3 deliverable groups (M7e, M7f, M7 QA Gate)
- Migration 0035 added (telegram_chat_id column)
- New packages/contact ContactService exported functions
- New apps/ussd-gateway Telegram Bot webhook handler
- Test count breakdown per package/app (≥ 655 platform total)
- P12/P13 enforcement points documented
- Confirmation that `pnpm -r typecheck` passes with 0 errors
- Link to NITDA self-assessment, CBN KYC audit, and NDPR consent audit docs

**PR Labels:** `milestone-7`, `m7e`, `m7f`, `m7-qa-gate`, `review-needed`

---

## M7e + M7f + QA Gate Summary Checklist

```
M7e — Nigeria UX Polish
[ ] apps/api/src/routes/airtime.ts — POST /airtime/topup (kobo, Termii, KYC T1, rate limit)
[ ] apps/api/src/routes/geography.ts — GET /geography/states + lgas + wards (public, cacheable)
[ ] apps/api/src/index.ts — wire airtime + geography routes
[ ] packages/frontend/src/i18n/pcm.ts — Naija Pidgin locale strings (55+ keys)
[ ] packages/frontend/src/i18n/en.ts — English baseline locale (matching keys)
[ ] packages/frontend/src/i18n/index.ts — re-exports + LocaleKey type
[ ] packages/frontend/src/ussd-shortcode.ts — USSD_SHORTCODE + formatUSSDPrompt + getUSSDDialLink
[ ] apps/api/src/middleware/low-data.ts — X-Low-Data: 1 strips media_urls recursively
[ ] apps/platform-admin/public/manifest.json — PWA manifest (Lighthouse req)
[ ] apps/platform-admin/public/sw.js — minimal service worker (Lighthouse req)
[ ] airtime.test.ts — ≥ 8 tests
[ ] geography.test.ts — ≥ 5 tests
[ ] i18n.test.ts — ≥ 4 tests (pcm keys match en, Pidgin smoke)
[ ] low-data middleware tests — ≥ 3 tests

M7f — Multi-Channel Contact Full Implementation
[ ] infra/db/migrations/0035_contact_telegram_chat_id.sql — ALTER TABLE ADD COLUMN
[ ] packages/contact/src/contact-service.ts — upsertContactChannels, getContactChannels,
    markChannelVerified, updateTelegramChatId, removeContactChannel,
    assertChannelConsent (P12), assertPrimaryPhoneVerified (P13), ContactError
[ ] packages/contact/src/channel-resolver.ts — routeOTPByPurpose, OTPPurpose, OTPRoutingError (R8)
[ ] packages/contact/src/index.ts — re-export all new exports
[ ] apps/api/src/routes/contact.ts — refactored to use ContactService
[ ] apps/ussd-gateway/src/telegram.ts — handleTelegramWebhook, sendTelegramMessage
[ ] apps/ussd-gateway/src/index.ts — POST /telegram/webhook route
[ ] packages/otp/src/whatsapp-meta.ts — 360dialog provider support
[ ] packages/otp/src/multi-channel.ts — WHATSAPP_PROVIDER env var routing
[ ] packages/auth/src/guards.ts — requirePrimaryPhoneVerified (P13)
[ ] apps/api/src/routes/integration.test.ts — ≥ 6 cross-vertical smoke tests
[ ] contact service tests — ≥ 10 tests (ContactService + P12/P13 + OTP routing)
[ ] telegram.test.ts — ≥ 5 tests
[ ] otp 360dialog tests — ≥ 3 tests

M7 QA Launch Gate
[ ] pnpm -r typecheck — 0 errors (ALL packages + apps)
[ ] pnpm -r test — all tests green (≥ 655 total)
[ ] apps/api/src/routes/pos.test.ts — float ledger reconciliation test added (≥ 3 cases)
[ ] docs/qa/nitda-self-assessment.md — all 12 NITDA provisions addressed
[ ] docs/qa/cbn-kyc-audit.md — all 4 CBN KYC tiers documented and test-verified
[ ] docs/qa/ndpr-consent-audit.md — all 11 data_types with consent check test evidence
[ ] docs/qa/security-review-m7.md — OTP replay, BVN enumeration, DM encryption, T3 audit
[ ] Lighthouse PWA score ≥ 80 — platform-admin audit result documented
[ ] NCC *384# registration submitted (external — document submission reference)
```

---

## Source Documents

All referenced specs are available on the `main` branch:

| Document | Path |
|---|---|
| Multi-Channel Contact Model | `docs/contact/multi-channel-model.md` |
| Contact Verification | `docs/contact/contact-verification.md` |
| OTP Routing Algorithm | `docs/contact/otp-routing.md` |
| OTP Channels | `docs/identity/otp-channels.md` |
| Claim-First Onboarding (Contact Form) | `docs/governance/claim-first-onboarding.md` |
| DM Privacy + AES-256-GCM | `docs/social/dm-privacy.md` |
| Feed Algorithm | `docs/social/feed-algorithm.md` |
| Social Graph | `docs/social/social-graph.md` |
| Social Moderation | `docs/social/social-moderation.md` |
| Community Model | `docs/community/community-model.md` |
| Community Entitlements | `docs/community/community-entitlements.md` |
| Community Moderation | `docs/community/community-moderation.md` |
| Platform Invariants (P1–P15) | `docs/governance/platform-invariants.md` |
| Security Baseline (R5–R10) | `docs/governance/security-baseline.md` |
| Entitlement Model | `docs/governance/entitlement-model.md` |
| NDPR Consent | `docs/enhancements/m7/ndpr-consent.md` |
| CBN KYC Tiers | `docs/enhancements/m7/kyc-compliance.md` |
| Offline Sync Runtime | `docs/enhancements/m7/offline-sync.md` |
| Milestone Tracker | `docs/governance/milestone-tracker.md` |
| M7c Brief (context reference) | `docs/milestones/m7c-replit-brief.md` |
| M7b Brief (format reference) | `docs/milestones/m7b-replit-brief.md` |
| M7c QA Brief (QA format reference) | `docs/qa/m7c-qa-brief.md` |
| M7b QA Report (QA pass reference) | `docs/qa/m7b-qa-report.md` |
| M7a QA Report (QA pass reference) | `docs/qa/m7a-qa-report.md` |

---

## Pre-Implementation Orientation Steps

Before writing any code, the implementing agent must:

1. **Read** `docs/governance/platform-invariants.md` — P1–P15 are non-negotiable
2. **Read** `docs/governance/security-baseline.md` — R5–R10 are non-negotiable
3. **Read** `docs/contact/multi-channel-model.md` + `docs/contact/contact-verification.md` + `docs/contact/otp-routing.md` — the ContactService must precisely follow these specs
4. **Review** existing `packages/contact/src/*.ts` — understand what's already built before adding to it
5. **Review** existing `apps/api/src/routes/contact.ts` — understand the inline D1 logic being refactored
6. **Review** `packages/otp/src/whatsapp-meta.ts` + `telegram-bot.ts` — extend, do not recreate
7. **Review** `infra/db/migrations/0018_contact_channels.sql` + `0021_contact_preferences.sql` — understand existing schema before adding migration 0035
8. **Run** `pnpm -r test` at the start of the session to confirm 609 baseline tests pass — do not proceed if tests are red

---

*Brief prepared by Replit QA Agent*
*2026-04-08 — WebWaka OS M7e + M7f + M7 QA Gate*
