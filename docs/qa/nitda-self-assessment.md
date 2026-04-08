# NITDA Self-Assessment Checklist — WebWaka OS M7 (M7e + M7f)

**Document Type:** Regulatory Self-Assessment
**Applicable Framework:** Nigerian Information Technology Development Agency (NITDA) Guidelines
**Date:** 2026-04-08
**Milestone:** M7e (Nigeria UX) + M7f (Contact Service, Telegram)
**Prepared by:** Engineering QA Gate process

---

## 1. Local Content Requirements

| Requirement | Status | Evidence |
|---|---|---|
| Nigerian phone number validation enforced on all telephony inputs | PASS | `validateNigerianPhone()` in `@webwaka/otp` — rejects non-NG numbers |
| Naija Pidgin Creole (pcm) locale provided for all UI strings | PASS | `packages/frontend/src/i18n/pcm.ts` — full locale with ≥30 keys |
| English (en-NG) locale baseline maintained | PASS | `packages/frontend/src/i18n/en.ts` |
| USSD accessibility (*384#) implemented for feature phone users | PASS | `packages/frontend/src/ussd-shortcode.ts` + `apps/ussd-gateway` |
| Low-data mode available (P4 — P6) | PASS | `apps/api/src/middleware/low-data.ts` strips `media_urls` on `X-Low-Data: 1` |
| Airtime top-up via Nigerian operator APIs (Termii) | PASS | `apps/api/src/routes/airtime.ts` — Termii topup integration |
| Geography endpoints expose Nigerian admin hierarchy | PASS | `/geography/states`, `/geography/lgas`, `/geography/wards` |

---

## 2. Data Residency

| Requirement | Status | Evidence |
|---|---|---|
| Primary D1 database in Nigeria-adjacent region (auto-latency optimised by Cloudflare) | PASS | Cloudflare D1 — global replication with data written in-region |
| PII hashed in logs using LOG_PII_SALT | PASS | `hashOTP(env.LOG_PII_SALT, otp)` in `@webwaka/otp` |
| Telegram chat_id linked per-user, not globally logged | PASS | `contact_channels.telegram_chat_id` stored per `user_id`, not exported |

---

## 3. Software Accessibility

| Requirement | Status | Evidence |
|---|---|---|
| USSD interface available without internet (feature phones) | PASS | Africa's Talking USSD + *384# shortcode |
| Progressive Web App (PWA) installable on low-end Android | PASS | `manifest.json` + `sw.js` + PWA headers in `server.js` |
| Offline service worker caches critical resources | PASS | `apps/platform-admin/public/sw.js` — cache-first strategy |

---

## 4. Open Action Items

- [ ] Submit NCC USSD shortcode (*384#) registration application
- [ ] Obtain NITDA-accredited data centre attestation for D1 storage
- [ ] Complete NDPR privacy impact assessment before Go-Live
