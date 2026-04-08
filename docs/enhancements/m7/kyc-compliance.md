# KYC Compliance — M7 Enhancement Specification

**Status:** Draft — M7 Enhancement Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Source:** Pre-Vertical Enhancement Research (Replit Agent 4, PR #18)
**Enhancements covered:** ENH-1 through ENH-16 (Security/Compliance category)
**Date:** 2026-04-08

---

## Overview

This document specifies the full KYC (Know Your Customer) and identity compliance layer for WebWaka OS, covering all 20 Priority 1 enhancements from the pre-vertical research. It is the authoritative source for implementation of `packages/identity`, CBN KYC tier gating, NDPR consent management, and all related schema migrations.

---

## CBN KYC Tier Framework

The Central Bank of Nigeria mandates three KYC tiers for any platform handling wallet, payment, or financial agent operations (CBN Circular FBN/DIR/GEN/CIR/07/011):

| Tier | Requirements | Transaction Limit |
|---|---|---|
| **Tier 0** | No verification (browse only) | No financial transactions |
| **Tier 1** | Name + Phone (OTP-verified) | ₦50,000/day max |
| **Tier 2** | BVN + Address verified | ₦200,000/day max |
| **Tier 3** | BVN + NIN + Utility bill + Face match | Unlimited |

WebWaka's entitlement model maps subscription tiers AND KYC tiers to transaction limits. Neither can be bypassed independently.

---

## Schema Migrations Required

### 0013 — Init Users Table (DAY 0 HOTFIX — merge to main before M7 begins)
```sql
-- Migration: 0013_init_users.sql
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email       TEXT UNIQUE NOT NULL,
  phone       TEXT,
  full_name   TEXT NOT NULL,
  password_hash TEXT,
  role        TEXT NOT NULL DEFAULT 'user',
  tenant_id   TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_tenant ON users(tenant_id);
```
**⚠️ CRITICAL:** `apps/api/src/routes/auth-routes.ts` queries this table. Any new D1 deployment without this migration will return 500 on all `/auth/*` routes.

### 0014 — KYC Fields on Individuals + Profiles
```sql
ALTER TABLE individuals ADD COLUMN nin TEXT;
ALTER TABLE individuals ADD COLUMN bvn TEXT;
ALTER TABLE individuals ADD COLUMN nin_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE individuals ADD COLUMN bvn_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN kyc_tier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN bvn_verified_at INTEGER;
ALTER TABLE profiles ADD COLUMN nin_verified_at INTEGER;
```

### 0015 — OTP Log (Replay Attack Prevention)
```sql
CREATE TABLE otp_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT,
  phone       TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,  -- SHA-256 of OTP value
  purpose     TEXT NOT NULL,  -- 'login' | 'kyc' | 'payment_verify'
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'used' | 'expired'
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX idx_otp_phone_hash_purpose ON otp_log(phone, otp_hash, purpose);
CREATE INDEX idx_otp_phone_pending ON otp_log(phone, status) WHERE status = 'pending';
```

### 0016 — KYC Records Audit Trail
```sql
CREATE TABLE kyc_records (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id      TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  record_type       TEXT NOT NULL,  -- 'BVN' | 'NIN' | 'CAC' | 'FRSC'
  provider          TEXT NOT NULL,  -- 'paystack' | 'prembly' | 'smile_id' | 'youverify'
  reference_id      TEXT,           -- Provider's reference
  status            TEXT NOT NULL,  -- 'verified' | 'failed' | 'pending'
  verified_at       INTEGER,
  raw_response_hash TEXT,           -- SHA-256 of raw response (not stored in full)
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
  -- Append-only: no UPDATE, no DELETE on this table
);
CREATE INDEX idx_kyc_user ON kyc_records(user_id, record_type);
CREATE INDEX idx_kyc_workspace ON kyc_records(workspace_id, created_at DESC);
```

### 0017 — NDPR Consent Records
```sql
CREATE TABLE consent_records (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  data_type         TEXT NOT NULL,  -- 'BVN' | 'NIN' | 'CAC' | 'phone' | 'email' | 'community_membership' | 'payment_data'
  purpose           TEXT NOT NULL,  -- Human-readable consent purpose
  consent_text_hash TEXT NOT NULL,  -- SHA-256 of the consent text shown to user
  consented_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  ip_hash           TEXT NOT NULL,  -- SHA-256(IP + daily_salt) — NDPR compliant
  revoked_at        INTEGER         -- NULL unless consent revoked
);
CREATE INDEX idx_consent_user_type ON consent_records(user_id, data_type);
CREATE INDEX idx_consent_tenant ON consent_records(tenant_id, consented_at DESC);
```

### 0018 — Missing Indexes
```sql
CREATE INDEX idx_individuals_phone ON individuals(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_individuals_email ON individuals(email) WHERE email IS NOT NULL;
CREATE INDEX idx_organizations_email ON organizations(email) WHERE email IS NOT NULL;
CREATE INDEX idx_organizations_registration_number ON organizations(registration_number) WHERE registration_number IS NOT NULL;
```

### 0019 — Webhook Idempotency Log
```sql
CREATE TABLE webhook_idempotency_log (
  idempotency_key TEXT PRIMARY KEY,
  endpoint        TEXT NOT NULL,
  request_hash    TEXT NOT NULL,
  response_code   INTEGER,
  processed_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### 0020 — Data Residency Tagging
```sql
ALTER TABLE individuals   ADD COLUMN data_residency TEXT NOT NULL DEFAULT 'NG';
ALTER TABLE organizations ADD COLUMN data_residency TEXT NOT NULL DEFAULT 'NG';
ALTER TABLE workspaces    ADD COLUMN data_residency TEXT NOT NULL DEFAULT 'NG';
```

---

## packages/identity Specification

**Location:** `packages/identity/src/`

### bvn.ts
```typescript
export interface BVNRecord {
  fullName: string;
  dob: string;
  phone: string;
  gender: string;
  enrollmentBank: string;
  verified: boolean;
}

export async function verifyBVN(bvn: string, workspaceId: string, env: Env): Promise<BVNRecord>
// Providers: Paystack /bank/resolve_bvn (primary), Prembly /api/v2/bvn (fallback)
// Must: (1) check consent_records exists, (2) write kyc_records entry, (3) update individuals.bvn_verified
// Tests: 12 unit tests (mock provider, error cases, consent check, rate limit)
```

### nin.ts
```typescript
export interface NINRecord {
  fullName: string;
  dob: string;
  phone: string;
  gender: string;
  stateOfOrigin: string;
  verified: boolean;
}

export async function verifyNIN(nin: string, workspaceId: string, env: Env): Promise<NINRecord>
// Provider: YouVerify /v2/api/identity/nin (primary), Prembly /api/v2/nin (fallback)
```

### frsc.ts
```typescript
export async function verifyFRSCOperator(licenceNumber: string, env: Env): Promise<FRSCRecord>
// Provider: Prembly /api/v2/frsc
// Stores in kyc_records with record_type = 'FRSC'
```

### cac.ts
```typescript
export async function verifyCACRegistration(rcNumber: string, env: Env): Promise<CACRecord>
// Provider: Prembly /api/v2/cac or VerifyMe
// Triggered on organization creation via event bus
```

---

## packages/otp Specification

**Location:** `packages/otp/src/`

Providers:
- **AfricasTalking** — Pan-Africa, MTN/GLO/Airtel/9mobile, USSD + SMS
- **Termii** — Nigeria-native, higher delivery rate on 9mobile

```typescript
export async function sendOTP(phone: string, otp: string, provider: 'africas_talking' | 'termii', env: Env): Promise<{ messageId: string }>
export async function verifyOTPDelivery(messageId: string, provider: string, env: Env): Promise<boolean>
// Per-phone rate limit: max 5 OTP sends per phone per hour (enforced via otp_log)
// Per-IP rate limit: max 10 OTP requests per IP per hour (enforced via rate-limit middleware)
```

---

## Rate Limiting Middleware

**Location:** `apps/api/src/middleware/rate-limit.ts`

Algorithm: Sliding window using `RATE_LIMIT_KV` (already provisioned in M0).

| Endpoint Group | Limit | Window |
|---|---|---|
| `/auth/*` | 10 req | 1 minute |
| `/identity/*` | 5 req | 1 minute |
| `/claim/verify` | 3 req | 1 minute |
| `/payments/verify` | 10 req | 1 minute |
| All others | 60 req | 1 minute |

**Nigeria-specific:** Rate limits use phone number as the primary key (not IP) for OTP endpoints, due to CGNAT on Nigerian mobile networks (MTN/GLO shared IPs).

---

## Risk Summary

| Risk | If Skipped |
|---|---|
| `users` table missing | 500 errors on all `/auth/*` routes on fresh deployment |
| CBN KYC non-compliance | Platform shutdown risk; CBN circular FBN/DIR/GEN/CIR/07/011 |
| NDPR no consent_records | NITDA fine: 2% gross revenue or ₦10M (whichever higher) |
| No SMS OTP | ~40% user drop-off (mobile-first users, no email fallback) |
| No rate limiting | OTP brute-force and BVN enumeration attacks viable |
