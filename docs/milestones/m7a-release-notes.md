# M7a Release Notes — Regulatory Survival + Multi-Channel Contact

**Status:** ✅ MERGED TO MAIN
**PR:** #21
**Merge SHA:** d62933982b9e2add66e1446cae88f61e218bceab
**Merged:** 2026-04-08
**QA Score:** 25/25 | Blockers: 0 | Regressions: 0
**QA Report:** `docs/qa/m7a-qa-report.md`

---

## Summary

M7a delivers the full Nigerian regulatory compliance stack for WebWaka:
CBN KYC Tiers (T0–T3), NDPR-compliant consent management, multi-provider
identity verification (BVN/NIN/CAC/FRSC), cryptographically secure OTP
delivery across SMS/WhatsApp/Telegram, and multi-channel contact management
with per-channel independent verification.

---

## Deliverables

### Database Migrations (9)
- `0013_init_users` — Platform auth user table (kyc_tier, contact_channels)
- `0014_kyc_fields` — BVN/NIN hash columns on individuals (R7: hash-only)
- `0015_otp_log` — OTP audit log (hash-only, append-only, replay protection)
- `0016_kyc_records` — Append-only KYC verification audit trail
- `0017_consent_records` — NDPR consent log (P10, revocable, ip_hash)
- `0018_contact_channels` — Multi-channel contact records (R10: per-channel verified)
- `0019_missing_indexes` — Performance indexes + data_residency='NG'
- `0020_webhook_idempotency` — Webhook deduplication log (R6, 7d TTL)
- `0021_contact_preferences` — OTP + notification channel preferences

### packages/identity
| File | Description |
|---|---|
| `bvn.ts` | BVN verification: Prembly primary + Paystack fallback |
| `nin.ts` | NIN verification via Prembly |
| `cac.ts` | CAC business lookup via Prembly |
| `frsc.ts` | FRSC driving license lookup via Prembly |
| `consent.ts` | `assertConsentExists()`, `hashPII()`, `maskPhone()`, `maskEmail()` |
| `types.ts` | Full type system: KYCResult interfaces, IdentityError, ConsentRecord |

### packages/otp
| File | Description |
|---|---|
| `termii-sms.ts` | Termii DND route SMS (primary Nigerian channel) |
| `whatsapp-meta.ts` | Meta Cloud API v18.0 (R8: blocks transaction OTPs) |
| `telegram-bot.ts` | Telegram Bot API (R8: blocks transaction + kyc_uplift) |
| `multi-channel.ts` | `sendMultiChannelOTP()` waterfall orchestrator |
| `channel-router.ts` | R8/R9 channel selection + rate limit keys |
| `otp-generator.ts` | `crypto.getRandomValues()` + SHA-256 hash |
| `phone-validator.ts` | E.164 + MTN/Airtel/Glo/9mobile detection |

### packages/contact
| File | Description |
|---|---|
| `normalize.ts` | `normalizeContactChannels()` UX model normalizer |
| `channel-resolver.ts` | `getPreferredOTPChannel()` (R10: verified-only) |
| `verification-state.ts` | `isChannelVerified()`, `getVerifiedChannels()` |

### packages/entitlements
| File | Description |
|---|---|
| `cbn-kyc-tiers.ts` | T0–T3 limits in Kobo + `requireKYCTier()` + `assertWithinTierLimits()` |

### apps/api
| Addition | Description |
|---|---|
| `routes/identity.ts` | POST /identity/verify-bvn, verify-nin, verify-cac, verify-frsc |
| `routes/contact.ts` | GET+PUT /contact/channels, POST verify/:channel, POST confirm/:channel, DELETE, GET+PUT preferences |
| `middleware/rate-limit.ts` | KV sliding-window (R5: 2/hr identity) |
| `middleware/audit-log.ts` | Structured audit log, IP masked /24 (R7) |
| `env.ts` | +7 new env vars declared |
| `index.ts` | M7a routes wired with auth + rate-limit + audit middleware |

### Tests
| Suite | Count |
|---|---|
| `packages/identity/identity.test.ts` | 59 tests |
| `packages/otp/otp.test.ts` | 40 tests |
| `packages/contact/contact.test.ts` | 17 tests |
| M6 regression guards | Updated (0 regressions) |
| **Total** | **116+** |

---

## Compliance Rules Shipped

| Rule | Description |
|---|---|
| P10 | NDPR consent gated before every BVN/NIN/CAC/FRSC lookup |
| P12 | Multi-channel consent tracking (SMS/WA/TG/email) |
| P13 | Primary phone mandatory in contact channels |
| R5 | Identity endpoint rate limit: 2/hr per user (KV) |
| R6 | Webhook idempotency: PRIMARY KEY on event_id |
| R7 | BVN/NIN/OTP/IP never stored raw — SHA-256(SALT+value) only |
| R8 | OTP channel restrictions: SMS mandatory for transaction; Telegram blocked for transaction+kyc_uplift |
| R9 | Channel-level OTP rate limits: SMS/WA=5/hr, TG/email=3/hr |
| R10 | Independent per-channel verification in contact_channels |

---

## Known Non-Blocking Items (M7b)

1. CORS wildcard `*.webwaka.com` — switch to origin function in M7b
2. `X-User-Id` header — confirm authMiddleware sets it server-side
3. `users` table vs `individuals` — add TDR before M7b

---

## Next: M7b — Offline + USSD + POS Float

- Dexie.js offline sync (P11: Dexie.js required)
- USSD gateway (`apps/ussd-gateway/`)
- POS float double-entry ledger (P9: float ledger invariant)
- Offline PWA manifest + service worker

**Target:** 3 days | Owner: Replit Agent → Base44 QA
