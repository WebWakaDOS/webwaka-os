# Contact Verification

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7a — Regulatory Survival
**Date:** 2026-04-08

---

## Overview

Each contact channel is **independently verified**. Verification is non-blocking for optional channels but **mandatory for primary_phone** before any financial operation (Platform Invariant P13).

---

## Verification Flow Per Channel

### Primary Phone (SMS OTP) — MANDATORY
```
1. User submits primary_phone (E.164 format)
2. POST /contact/verify/otp { channel: "sms", phone: "+234..." }
   → Termii sends SMS OTP (6 digits, 10 min TTL)
   → Store hashed OTP in KV: otp:sms:{phone} → { hash, attempts: 0, expires }
3. User submits OTP
   POST /contact/verify/confirm { channel: "sms", phone: "+234...", code: "123456" }
   → Verify hash, check TTL, check attempts ≤ 3
   → On success: contact_channels.primary_phone_verified = true
   → On fail (attempt 3): lock phone for 30 min (R9)
```

### WhatsApp Verification
```
1. User provides whatsapp_phone (or ticks "same as primary")
2. POST /contact/verify/otp { channel: "whatsapp", phone: "+234..." }
   → Termii/360dialog sends WhatsApp message: "Your WebWaka code: 123456"
3. User submits OTP → same confirm flow as SMS
4. On success: contact_channels.whatsapp_verified = true
```

### Telegram Verification
```
1. User provides telegram_handle (@username)
2. Server generates a one-time code (8 chars): "WW-A3F9KL2P"
3. POST /contact/verify/otp { channel: "telegram", handle: "@username" }
   → WebWaka Telegram Bot sends DM to @username: "Your verification code: WW-A3F9KL2P"
   → Store in KV: otp:telegram:{handle} → { code, expires }
4. User types code into WebWaka app
   POST /contact/verify/confirm { channel: "telegram", handle: "@username", code: "WW-..." }
   → On success: contact_channels.telegram_verified = true
                  contact_channels.telegram_chat_id = (from bot update)
```

### Email Verification
```
1. User provides email address
2. POST /contact/verify/otp { channel: "email", email: "user@example.com" }
   → Send verification link (JWT, 24h TTL): https://app.webwaka.ng/verify-email?token=...
3. User clicks link → GET /auth/verify-email?token=...
   → On success: contact_channels.email_verified = true
```

---

## OTP Security Rules (R9/R10 enforcement)

```typescript
const OTP_RULES = {
  sms:      { ttl: 600,    maxAttempts: 3, lockDuration: 1800,  rateLimitPerHour: 5  },
  whatsapp: { ttl: 600,    maxAttempts: 3, lockDuration: 1800,  rateLimitPerHour: 5  },
  telegram: { ttl: 1800,   maxAttempts: 5, lockDuration: 3600,  rateLimitPerHour: 3  },
  email:    { ttl: 86400,  maxAttempts: 1, lockDuration: 86400, rateLimitPerHour: 3  },
};
```

Rate limiting keys:
- `rate:otp:sms:{phone}` — sliding window, max 5/hour
- `rate:otp:ip:{ip}` — sliding window, max 10/hour across all channels
- `lock:otp:{channel}:{identifier}` — hard lock on max attempts

---

## NDPR Consent Integration

Before sending any OTP to a channel:
1. Check `consent_records` for the relevant `data_type`:
   - SMS → `data_type: 'phone'`
   - WhatsApp → `data_type: 'whatsapp'`
   - Telegram → `data_type: 'telegram'`
   - Email → `data_type: 'email'`
2. If no active consent record → prompt user for consent before sending
3. Consent is captured as part of the verification form (checkbox: "I agree to receive messages via SMS")

---

## Event Log

All verification events are written to `event_log`:
```sql
INSERT INTO event_log (id, tenant_id, entity_id, event_type, payload, created_at) VALUES
  (..., 'contact.otp_sent',      { channel, masked_recipient, provider }),
  (..., 'contact.otp_verified',  { channel, masked_recipient }),
  (..., 'contact.otp_failed',    { channel, attempt, remaining }),
  (..., 'contact.channel_locked', { channel, locked_until });
```

---

## Related Docs
- `docs/contact/multi-channel-model.md` — ContactChannels entity schema
- `docs/contact/otp-routing.md` — Channel selection algorithm
- `docs/identity/otp-channels.md` — Provider details
- `docs/governance/security-baseline.md` — R8, R9, R10
