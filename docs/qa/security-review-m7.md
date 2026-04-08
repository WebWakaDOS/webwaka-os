# Security Review — WebWaka OS M7 (M7e + M7f)

**Document Type:** Security Baseline Review
**Date:** 2026-04-08
**Milestone:** M7e (Nigeria UX) + M7f (Contact Service, Telegram webhook, 360dialog)
**Reviewed against:** `docs/governance/security-baseline.md`
**Prepared by:** Engineering QA Gate process

---

## 1. Authentication & Authorisation

| Control | Implementation | Status |
|---|---|---|
| JWT-based auth on all API routes | `apps/api/src/index.ts` — auth middleware applied before routes | PASS |
| P13: Financial operations gated on verified primary phone | `requirePrimaryPhoneVerified()` in `packages/auth/src/guards.ts` | PASS |
| P12: NDPR consent required before channel OTP send | `assertChannelConsent()` in `packages/contact/src/contact-service.ts` | PASS |
| Telegram webhook validates `X-Telegram-Bot-Api-Secret-Token` | Constant-time comparison in `apps/ussd-gateway/src/index.ts` webhook handler | PASS |
| USSD sessions expire after 3 minutes | `USSD_SESSION_KV` TTL enforced in `getOrCreateSession()` | PASS |

---

## 2. Input Validation

| Control | Implementation | Status |
|---|---|---|
| Nigerian phone validation (P2) | `validateNigerianPhone()` — validates E.164 with Nigerian prefix | PASS |
| Integer kobo enforcement (T4) | `assertIntegerKobo()` — rejects non-integer monetary values | PASS |
| Airtime amount bounds check | Min 5,000 kobo (₦50), Max 500,000 kobo (₦5,000) | PASS |
| Channel type allowlist | `['sms','whatsapp','telegram','email']` — strict enum on all channel params | PASS |
| OTP purpose allowlist | `['verification','login','transaction','kyc_uplift','password_reset']` | PASS |
| Telegram update body validated before processing | `TelegramUpdate` typed interface — message optional | PASS |

---

## 3. Rate Limiting

| Channel | Limit | Key Pattern | Status |
|---|---|---|---|
| SMS OTP | 5/hr per phone | `rate:otp:sms:{phone_hash}` | PASS |
| WhatsApp OTP | 5/hr per phone | `rate:otp:whatsapp:{phone_hash}` | PASS |
| Telegram OTP | 3/hr per handle | `rate:otp:telegram:{handle_hash}` | PASS |
| Airtime top-up | 5/hr per user | `rate:airtime:{userId}` | PASS |
| USSD sessions | 30/hr per phone | `rate:ussd:{phone}` | PASS |

---

## 4. Secrets Management

| Secret | Storage | Status |
|---|---|---|
| `TERMII_API_KEY` | Cloudflare Worker secret | PASS |
| `WHATSAPP_ACCESS_TOKEN` | Cloudflare Worker secret | PASS |
| `DIALOG360_API_KEY` | Cloudflare Worker secret | PASS |
| `TELEGRAM_BOT_TOKEN` | Cloudflare Worker secret | PASS |
| `TELEGRAM_WEBHOOK_SECRET` | Cloudflare Worker secret | PASS |
| `LOG_PII_SALT` | Cloudflare Worker secret | PASS |
| `JWT_SECRET` | Cloudflare Worker secret | PASS |

No secrets committed to source control. All env vars declared in `apps/api/src/env.ts` as string types — Cloudflare Workers runtime injects at deploy time.

---

## 5. Content Security Policy

| App | CSP Header | Status |
|---|---|---|
| `apps/platform-admin` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` | PASS |

PWA service worker served with `Cache-Control: no-cache, no-store, must-revalidate` to prevent stale SW registration.

---

## 6. Threat Model Summary (M7-scope)

| Threat | Mitigation | Risk Level |
|---|---|---|
| Fake Telegram bot impersonation | Webhook secret header validates origin | LOW |
| OTP replay via Telegram | OTP expires after 10 min; single-use enforced in `otp_log` | LOW |
| Airtime fraud (rapid top-up) | 5/hr rate limit + insufficient float check | MEDIUM |
| Phone harvesting via geography API | Public endpoints, no PII exposed — places data only | LOW |
| Low-data bypass (client strips header) | Server-side enforcement — client header is opt-in, not security boundary | INFO |
| Telegram chat_id enumeration | chat_id only stored after `/start` from verified handle | LOW |

---

## 7. Findings and Recommendations

### M7e/M7f — No Critical Findings

**Recommended improvements (non-blocking):**
1. Add `Strict-Transport-Security` header to `platform-admin` server responses
2. Replace `'unsafe-inline'` in CSP style-src with nonce-based CSP when CSS-in-JS is removed
3. Add DTIA for Telegram + Meta API cross-border data transfers (NDPR compliance)
4. Implement Telegram message queue with exponential backoff for failed sends
5. Consider rotating `TELEGRAM_WEBHOOK_SECRET` quarterly

---

## 8. QA Gate Result

| Gate | Pass Criteria | Result |
|---|---|---|
| P12 consent guard | All OTP sends require consent_records lookup | PASS |
| P13 phone guard | Financial ops gated on verified primary phone | PASS |
| R8 OTP routing | transaction/kyc_uplift → SMS only | PASS |
| T4 integer kobo | All monetary inputs validated as integers | PASS |
| PWA headers | manifest.json + sw.js + CSP served correctly | PASS |
| Test coverage | ≥ 655 tests (baseline 609 + 46 new) | PENDING (run `pnpm -r test`) |
