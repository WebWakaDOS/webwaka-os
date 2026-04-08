# OTP Channels

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Nigeria Platform Hardening (M7a)
**Date:** 2026-04-08

---

## Overview

WebWaka OS uses OTP (One-Time Passcode) for phone verification (KYC Tier 1), transaction confirmation, and login challenges. Multiple channels are supported via the `packages/otp` provider abstraction (TDR-0009 extension).

---

## Channel Priority

OTP delivery follows a waterfall priority, falling through to the next channel on failure:

```
1. SMS (primary) — Termii
2. WhatsApp (secondary) — WhatsApp Business API via Termii or 360dialog
3. USSD (tertiary) — Africa's Talking USSD push (for feature phones)
4. Voice Call (emergency) — Termii voice OTP (for accessibility)
```

Channel selection logic:

```typescript
// packages/otp/src/channel-selector.ts
export function selectOTPChannel(user: User, attempt: number): OTPChannel {
  if (attempt === 1) return 'sms';
  if (attempt === 2 && user.whatsapp_opted_in) return 'whatsapp';
  if (attempt === 3) return 'ussd';
  if (attempt >= 4) return 'voice';
  return 'sms';
}
```

---

## Providers

### SMS: Termii
- **API:** `https://api.ng.termii.com/api/sms/otp/send`
- **Secret:** `TERMII_API_KEY` (Cloudflare Worker secret)
- **Coverage:** All Nigerian carriers (MTN, Airtel, Glo, 9mobile)
- **Delivery time:** ~3–10 seconds
- **DND (Do Not Disturb) handling:** Termii auto-routes via Device messaging if DND active

### SMS Fallback: Africa's Talking
- **API:** `https://api.africastalking.com/version1/messaging`
- **Secret:** `AFRICASTALKING_API_KEY`
- **Used:** When Termii returns non-200 on delivery

### WhatsApp: Termii WhatsApp
- **API:** `https://api.ng.termii.com/api/sms/otp/send` with `channel: 'whatsapp'`
- **Pre-requisite:** User must have opted into WhatsApp communications (NDPR consent: `data_type = 'whatsapp_comms'`)
- **Delivery time:** ~5–15 seconds

### USSD Push
- **Provider:** Africa's Talking USSD
- **Flow:** User is asked to dial `*384*{otp_code}#` to confirm
- **Use case:** Feature phones, severe data outages

### Voice Call
- **Provider:** Termii Voice
- **Flow:** Automated call reads 6-digit OTP
- **Use case:** Accessibility, elderly users, repeated SMS failure

---

## OTP Configuration

```typescript
interface OTPConfig {
  length: 6;             // Always 6 digits
  ttl_seconds: 600;      // 10 minutes
  max_attempts: 5;       // Before lockout
  lockout_seconds: 900;  // 15-minute lockout after max attempts
  resend_cooldown: 60;   // 60 seconds before resend allowed
}
```

OTP codes are generated using `crypto.getRandomValues()` (Cloudflare Workers Web Crypto API). Not `Math.random()`.

---

## Rate Limiting (R5 Enforcement)

| Limit | Threshold | Window |
|---|---|---|
| OTP send | 3 requests | 10 minutes per phone number |
| OTP verify | 5 attempts | 10 minutes per phone number |
| Resend | 1 per 60 seconds | Per phone number |
| Daily OTP | 10 total | Per phone number per day |

Keys stored in `RATE_LIMIT_KV`. Exceeding limits returns HTTP 429 with `Retry-After`.

---

## OTP Storage

OTPs are stored hashed (not plain text):
- Hash: `SHA-256(phone + otp_code + tenant_id)`
- Storage: `otp_challenges` D1 table with TTL enforced by scheduled cleanup
- Never returned in API responses after initial send
- Deleted immediately on successful verification

---

## Nigerian Phone Number Validation

All phone numbers are validated before OTP dispatch:

```typescript
// packages/otp/src/phone-validator.ts
// Validates Nigerian numbers: +234XXXXXXXXXX or 0XXXXXXXXXX
// Supported carriers: MTN (0803, 0806, 0816, 0813, 0814, 0903, 0906)
//                     Airtel (0802, 0808, 0812, 0701, 0708, 0902)
//                     Glo (0805, 0807, 0815, 0905, 0811)
//                     9mobile (0809, 0817, 0818, 0908, 0909)
export function validateNigerianPhone(phone: string): PhoneValidationResult {
  const normalized = normalizeToE164(phone); // +234...
  const carrier = detectCarrier(normalized);
  return { valid: !!carrier, normalized, carrier };
}
```

Invalid phone numbers are rejected before OTP send — not after delivery failure.

---

## Audit Logging

All OTP events emit an audit log entry:
- `otp.sent` — includes `{ phone_masked: '****1234', channel, tenant_id, timestamp }`
- `otp.verified` — includes `{ phone_masked, result: 'success'|'wrong_code'|'expired', attempts }`
- `otp.locked` — includes `{ phone_masked, lockout_until }`

Never log the OTP code itself or full phone number (R7 — PII hashing).
