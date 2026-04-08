# Multi-Channel Contact Model

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7a — Regulatory Survival
**Date:** 2026-04-08

---

## Overview

WebWaka OS supports multiple verified contact channels per user, enabling:
- **Redundant OTP delivery** (SMS → WhatsApp → Telegram fallback)
- **Preference-based communication** (user chooses primary notification channel)
- **KYC tier uplift** (each verified channel increases trust score)
- **NDPR compliance** (per-channel explicit consent, revocable independently)

---

## ContactChannels Entity

```typescript
interface ContactChannels {
  id: string;                           // UUID
  entity_id: string;                    // FK → entities.id
  primary_phone: string;                // E.164 (+234...) — MANDATORY, SMS-capable
  primary_phone_verified: boolean;      // SMS OTP verified
  primary_phone_verified_at: number;    // unix timestamp

  whatsapp_phone: string | null;        // E.164 — may differ from primary
  whatsapp_verified: boolean;
  whatsapp_verified_at: number | null;
  whatsapp_same_as_primary: boolean;    // UI checkbox → copy primary_phone

  telegram_handle: string | null;       // @handle (no leading @)
  telegram_chat_id: string | null;      // populated after bot handshake
  telegram_verified: boolean;
  telegram_verified_at: number | null;

  email: string | null;                 // optional
  email_verified: boolean;
  email_verified_at: number | null;

  notification_preference: NotificationPreference;
  otp_preference: OTPPreference;

  created_at: number;
  updated_at: number;
  tenant_id: string;
}

type NotificationPreference = 'sms' | 'whatsapp' | 'telegram' | 'email';
type OTPPreference         = 'sms' | 'whatsapp' | 'telegram';
```

### Constraints
- `primary_phone` is **mandatory** — Platform Invariant P13.
- Only one `ContactChannels` record per `entity_id` (unique constraint).
- `whatsapp_phone` defaults to `primary_phone` when `whatsapp_same_as_primary = true`.
- `telegram_chat_id` is populated server-side after Telegram Bot handshake — never sent by client.

---

## D1 Migration

```sql
-- Migration 0036_contact_channels.sql
CREATE TABLE IF NOT EXISTS contact_channels (
  id            TEXT PRIMARY KEY,
  entity_id     TEXT NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL,

  primary_phone       TEXT NOT NULL,
  primary_phone_verified    INTEGER NOT NULL DEFAULT 0,
  primary_phone_verified_at INTEGER,

  whatsapp_phone          TEXT,
  whatsapp_verified        INTEGER NOT NULL DEFAULT 0,
  whatsapp_verified_at     INTEGER,
  whatsapp_same_as_primary INTEGER NOT NULL DEFAULT 1,

  telegram_handle   TEXT,
  telegram_chat_id  TEXT,
  telegram_verified  INTEGER NOT NULL DEFAULT 0,
  telegram_verified_at INTEGER,

  email             TEXT,
  email_verified     INTEGER NOT NULL DEFAULT 0,
  email_verified_at  INTEGER,

  notification_preference TEXT NOT NULL DEFAULT 'sms',
  otp_preference          TEXT NOT NULL DEFAULT 'sms',

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_contact_channels_entity ON contact_channels(entity_id);
CREATE INDEX idx_contact_channels_tenant ON contact_channels(tenant_id);
CREATE INDEX idx_contact_channels_primary_phone ON contact_channels(primary_phone);
```

---

## API Routes

```
POST   /contact/channels              → create or update contact channels (idempotent)
GET    /contact/channels/:entity_id   → fetch contact channels for entity
POST   /contact/verify/otp            → request OTP for a specific channel
POST   /contact/verify/confirm        → confirm OTP → mark channel verified
DELETE /contact/channels/:channel     → remove optional channel (not primary_phone)
GET    /contact/channels/search?phone → check if phone is registered (platform-level)
```

---

## KYC Tier Integration

Each verified channel contributes to the entity's effective KYC tier:

| Channel | Contributes To |
|---|---|
| primary_phone (SMS) verified | KYC Tier 1 prerequisite |
| whatsapp_phone verified | Tier 1 → 2 uplift signal |
| email verified | Tier 1 → 2 uplift signal |
| telegram verified | Trust score (no tier change) |

---

## Related Docs
- `docs/identity/otp-channels.md` — OTP delivery routing + fallback
- `docs/contact/contact-verification.md` — Verification flow per channel
- `docs/contact/otp-routing.md` — Channel selection algorithm
- `docs/governance/platform-invariants.md` — P12, P13
- `docs/governance/entitlement-model.md` — KYC tier gating
