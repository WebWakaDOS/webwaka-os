# NDPR Consent Requirements

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Nigeria Platform Hardening
**Date:** 2026-04-08

---

## Overview

The Nigeria Data Protection Regulation (NDPR) 2019, enforced by the National Information Technology Development Agency (NITDA), requires explicit, purpose-specific, granular consent before processing any personal data. This document defines the consent model for WebWaka OS and its implementation requirements.

---

## Legal Basis

- **NDPR 2019** (NITDA) — Article 2.1: Consent must be specific, informed, freely given, unambiguous.
- **Nigeria Data Protection Act 2023** (NDPA) — Section 25: Right to withdraw consent at any time.
- **CBN KYC Regulations** — Consent required before identity document lookup (BVN/NIN).

---

## Consent Record Model

All consent is stored in the `consent_records` D1 table:

```sql
CREATE TABLE consent_records (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  data_type       TEXT NOT NULL,   -- see data types below
  purpose         TEXT NOT NULL,   -- plain-language description
  consented_at    INTEGER NOT NULL, -- Unix epoch
  withdrawn_at    INTEGER,         -- null until withdrawn
  ip_hash         TEXT NOT NULL,   -- SHA-256(SALT + ip) per R7
  user_agent_hash TEXT NOT NULL,
  version         TEXT NOT NULL    -- consent text version e.g. 'ndpr_v2'
);
```

---

## Consent Data Types

| `data_type` | Trigger | Purpose Description |
|---|---|---|
| `account_creation` | Registration | "Creating and managing your WebWaka account" |
| `payment_data` | First payment action | "Processing your payment transactions" |
| `BVN` | BVN verification flow | "Verifying your Bank Verification Number for financial transactions" |
| `NIN` | NIN verification flow | "Verifying your National Identification Number for identity compliance" |
| `CAC` | Business verification | "Verifying your company registration with CAC" |
| `FRSC` | Transport operator verification | "Verifying your FRSC operator license" |
| `community_membership` | Joining a community | "Storing your community membership profile and activity" |
| `dm_data` | Sending/receiving DMs | "Storing your direct message conversations" |
| `location_data` | Location-based features | "Using your location for nearby discovery" |
| `marketing` | Optional marketing consent | "Sending you product updates and promotions" |
| `analytics` | Workspace analytics | "Including your activity in workspace analytics reports" |

---

## Platform Invariant P10 Enforcement

Every BVN or NIN lookup must:

1. Check `consent_records` for an active consent (`withdrawn_at IS NULL`) with `data_type IN ('BVN', 'NIN')` for that user.
2. If no consent exists → Show consent screen, collect consent, INSERT record → proceed.
3. If consent exists but `version` is stale → Show updated consent screen, collect fresh consent, UPDATE record.
4. Never log BVN or NIN values (R7 — PII hashing in logs).

Implementation: `requireConsentFor(ctx, userId, dataType)` in `packages/identity/consent.ts`.

---

## Consent Withdrawal

Users may withdraw any consent at any time from their privacy settings:

```
User requests withdrawal
  → consent_records.withdrawn_at = now()
  → Data processing stops for that purpose
  → Existing data: retained for legal hold period (90 days) then purged
  → User notified via email/SMS of withdrawal confirmation
```

Withdrawal of `BVN` consent does not remove the verified KYC tier — it stops future lookups. The tier remains (already verified).

Withdrawal of `account_creation` is equivalent to account deletion — 30-day grace period before full purge.

---

## Consent UI Requirements

All consent screens must:

1. Use plain language — no legal jargon. Available in English and Naija Pidgin (pcm).
2. List exactly what data is collected and why (no bundled consent).
3. Include a link to the full Privacy Policy.
4. Record consent atomically — one screen = one `consent_records` INSERT.
5. Never pre-tick consent checkboxes (NDPR Article 2.1(b) — unambiguous).

---

## Audit Trail

- All consent_records are append-only (no UPDATE — only INSERT new record or set `withdrawn_at`).
- NITDA audit: WebWaka must be able to produce consent history for any user on 48-hour notice.
- Annual NDPR compliance audit required. Self-assessment against NITDA Compliance Framework.
