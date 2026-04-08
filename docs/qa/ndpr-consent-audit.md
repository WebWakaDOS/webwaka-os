# NDPR Consent Audit — WebWaka OS M7 (M7e + M7f)

**Document Type:** Data Protection Compliance Audit
**Applicable Framework:** Nigeria Data Protection Regulation (NDPR) 2019
**Date:** 2026-04-08
**Milestone:** M7e (Nigeria UX) + M7f (Contact Service + Telegram)
**Prepared by:** Engineering QA Gate process

---

## 1. Lawful Basis for Processing

| Data Category | Lawful Basis | Enforcement Point | Status |
|---|---|---|---|
| Primary phone number (SMS) | Consent + Contractual necessity | `assertChannelConsent(db, userId, 'sms', tenantId)` | PASS |
| WhatsApp phone number | Explicit consent | `assertChannelConsent(db, userId, 'whatsapp', tenantId)` | PASS |
| Telegram handle + chat_id | Explicit consent | `assertChannelConsent(db, userId, 'telegram', tenantId)` | PASS |
| Email address | Explicit consent | `assertChannelConsent(db, userId, 'email', tenantId)` | PASS |

All channel consent checks query `consent_records` table keyed on `(user_id, data_type, tenant_id)`. Missing record throws `ContactError { code: 'CONSENT_REQUIRED' }` returning HTTP 403 — no data processed without explicit consent (P12).

---

## 2. Data Minimisation (NDPR Article 2.1(c))

| Principle | Implementation | Status |
|---|---|---|
| Low-data mode strips media assets on X-Low-Data: 1 | `lowDataMiddleware` removes `media_urls[]` from JSON responses | PASS |
| OTP codes never stored in plain text | `hashOTP(LOG_PII_SALT, otp)` — bcrypt-style hash stored | PASS |
| PII in logs hashed with LOG_PII_SALT | Phone numbers hashed before logging | PASS |
| Telegram chat_id stored per-user, minimal scope | `telegram_chat_id` column in `contact_channels` — user-scoped | PASS |

---

## 3. Data Subject Rights

| Right | Implementation | Status |
|---|---|---|
| Right to withdraw consent | `DELETE /contact/channels/:channel` removes channel data | PASS |
| Right to access | `GET /contact/channels` returns all channels for the user | PASS |
| Right to rectification | `PUT /contact/channels` allows update of phone/handle values | PASS |
| Right to erasure | Removing a channel deletes the row via `removeContactChannel()` | PASS |

---

## 4. Cross-Border Transfer Controls

| Control | Implementation | Status |
|---|---|---|
| Telegram Bot API calls to Telegram servers (Netherlands) | Outbound only — no PII sent beyond handle lookup and chat_id | PARTIAL |
| WhatsApp (Meta) Graph API calls | OTP content only — no stored PII exported | PARTIAL |
| Termii SMS API | Nigerian-headquartered SMS provider | PASS |

> Note: Telegram and Meta API integrations require Data Transfer Impact Assessment (DTIA) before production launch.

---

## 5. Consent Record Schema

```sql
-- consent_records table (enforces P12)
CREATE TABLE consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  data_type TEXT NOT NULL,  -- 'phone' | 'whatsapp' | 'telegram' | 'email'
  granted_at INTEGER NOT NULL,
  withdrawn_at INTEGER,
  ip_address TEXT,          -- hashed
  user_agent TEXT           -- stripped to platform only
);
```

---

## 6. Open Action Items

- [ ] Implement consent withdrawal webhook to Telegram (delete chat data)
- [ ] Add DTIA documentation for Meta/Telegram API integrations
- [ ] Commission external NDPR audit by NITDA-accredited Data Protection Compliance Organisation (DPCO)
- [ ] Publish Privacy Policy v2 referencing M7f channel additions
