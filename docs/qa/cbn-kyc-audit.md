# CBN KYC Audit Checklist — WebWaka OS M7 (M7e + M7f)

**Document Type:** KYC Compliance Audit (Internal)
**Applicable Framework:** Central Bank of Nigeria (CBN) KYC/AML Guidelines
**Date:** 2026-04-08
**Milestone:** M7e (Nigeria UX) + M7f (Contact + Auth guards)
**Prepared by:** Engineering QA Gate process

---

## 1. Identity Verification Tiers

| KYC Tier | Requirement | Status | Evidence |
|---|---|---|---|
| T1 | Phone number verified via SMS OTP | PASS | `POST /contact/verify/sms` + `POST /contact/confirm/sms` |
| T2 | BVN or NIN linkage | IN PROGRESS | M7g milestone — identity uplift routes planned |
| T3 | Government-issued ID upload | IN PROGRESS | M7g milestone — document upload KYC |

---

## 2. OTP Channel Security (R8 — CBN transaction requirements)

| Rule | Requirement | Status | Evidence |
|---|---|---|---|
| R8 | Transaction/KYC-uplift OTPs must use SMS only | PASS | `routeOTPByPurpose()` blocks Telegram for `transaction` + `kyc_uplift` purposes |
| R8 | WhatsApp permitted as fallback but not primary for transactions | PASS | `sendMultiChannelOTP()` waterfall — SMS first, WA only on SMS failure |
| R9 | OTP rate limiting enforced (5/hr SMS, 3/hr Telegram) | PASS | `RATE_LIMIT_KV` keyed by `rate:otp:{channel}:{identifier}` |

---

## 3. Primary Phone Verification Guard (P13)

| Guard | Requirement | Status | Evidence |
|---|---|---|---|
| P13 | Financial operations require verified primary phone | PASS | `requirePrimaryPhoneVerified()` in `packages/auth/src/guards.ts` |
| P13 | Contact service validates verified primary phone before uplift | PASS | `assertPrimaryPhoneVerified()` in `packages/contact/src/contact-service.ts` |

---

## 4. Float / Wallet Integrity

| Requirement | Status | Evidence |
|---|---|---|
| All monetary values stored as integer kobo (T4) | PASS | `assertIntegerKobo()` enforced in airtime + POS routes |
| Float deductions atomic with ledger inserts (T4) | PASS | `agent_wallets` deduct + `float_ledger` insert in single D1 transaction |
| Airtime operator rate limited per agent (R9 variant) | PASS | `rate:airtime:{userId}` — 5/hr cap in `apps/api/src/routes/airtime.ts` |

---

## 5. Audit Trail

| Requirement | Status | Evidence |
|---|---|---|
| `otp_log` records all OTP sends with purpose, channel, status | PASS | `INSERT INTO otp_log` on every `POST /contact/verify` |
| `float_ledger` records all float movements | PASS | POS + airtime routes insert ledger entries |
| `consent_records` NDPR consent persisted per channel | PASS | `assertChannelConsent()` reads `consent_records` table |

---

## 6. Open Action Items

- [ ] Complete T2/T3 KYC tiers (M7g)
- [ ] Submit CBN Sandbox approval for payment operations
- [ ] Integrate NIBSS for BVN verification
- [ ] Enable transaction monitoring (AML velocity rules)
