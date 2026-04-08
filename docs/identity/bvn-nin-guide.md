# BVN/NIN Verification Guide

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Nigeria Platform Hardening (M7a)
**Date:** 2026-04-08

---

## Overview

WebWaka OS supports Bank Verification Number (BVN) and National Identification Number (NIN) verification for CBN KYC Tier 2 and Tier 3 compliance respectively. All identity lookups are governed by Platform Invariant P10 (NDPR consent required before any lookup).

---

## Verification Providers

### Primary: Prembly (IdentityPass)

**Base URL:** `https://api.prembly.com/identitypass/verification`

| Document | Endpoint | Response Time |
|---|---|---|
| BVN Basic | `/biometric/bvn` | ~1s |
| BVN with Face Match | `/biometric/bvn/face` | ~3s |
| NIN | `/government-data/nin` | ~2s |
| NIN with Face Match | `/government-data/nin/face` | ~4s |
| CAC (RC Number) | `/business/cac` | ~5s |
| FRSC License | `/government-data/frsc` | ~3s |

**Auth:** `x-api-key: {PREMBLY_API_KEY}` (Cloudflare Worker secret)

### Secondary: Paystack Identity (BVN only)

**Base URL:** `https://api.paystack.co/bank/resolve_bvn`

Used as fallback when Prembly BVN returns 5xx. Paystack BVN does not support face match.

### NIMC Gateway (NIN — Tier 3 fallback)

NIMC (National Identity Management Commission) direct gateway. Requires a separate NIMC data access agreement. Used when Prembly NIN lookup fails.

---

## Implementation: `packages/identity`

### BVN Verification

```typescript
// packages/identity/src/providers/prembly.ts
export async function verifyBVN(
  bvn: string,
  consent: ConsentRecord,
  options?: { withFaceMatch?: boolean; selfieImage?: string }
): Promise<BVNVerifyResult> {
  // Invariant P10: consent must exist
  assertConsentExists(consent, 'BVN');
  
  const response = await fetch(
    `${PREMBLY_BASE_URL}/biometric/bvn${options?.withFaceMatch ? '/face' : ''}`,
    {
      method: 'POST',
      headers: { 'x-api-key': env.PREMBLY_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: bvn,
        ...(options?.withFaceMatch && { image: options.selfieImage })
      })
    }
  );
  
  // Rate limit check — R5: 2 BVN lookups per user per hour
  await checkRateLimit(`bvn_lookup:${consent.user_id}`, { max: 2, windowSeconds: 3600 });
  
  return parseBVNResponse(response);
}
```

### NIN Verification

```typescript
export async function verifyNIN(
  nin: string,
  consent: ConsentRecord
): Promise<NINVerifyResult> {
  assertConsentExists(consent, 'NIN');
  await checkRateLimit(`nin_lookup:${consent.user_id}`, { max: 2, windowSeconds: 3600 });
  // ...Prembly NIN call
}
```

### Result Types

```typescript
interface BVNVerifyResult {
  verified: boolean;
  full_name: string;      // Returned from BVN record
  phone_match: boolean;   // Does BVN phone match user's registered phone?
  dob_match?: boolean;    // Optional — only if dob provided
  face_match_score?: number; // 0–1, only with face match
  provider: 'prembly' | 'paystack';
}

interface NINVerifyResult {
  verified: boolean;
  full_name: string;
  gender: string;
  dob: string;
  face_match_score?: number;
  provider: 'prembly' | 'nimc';
}
```

---

## Data Handling Rules

| Rule | Detail |
|---|---|
| BVN value | **NEVER logged** (R7). Hashed with `SHA-256(SALT + bvn)` for deduplication only |
| NIN value | **NEVER logged** (R7). Same hashing rule |
| Name returned | Stored as `verified_name` on user profile — never raw from provider to client |
| Face image | Processed in-flight only. Never stored on WebWaka servers |
| Provider response | Logged with PII stripped: only `{ verified: bool, provider, timestamp }` |

---

## Error Handling

| Error Code | Meaning | Action |
|---|---|---|
| `bvn_not_found` | BVN does not exist in NIBSS | Show error, allow retry |
| `bvn_mismatch` | BVN details don't match user input | Show error, allow retry (max 3) |
| `nin_not_found` | NIN not in NIMC database | Prompt user to visit NIMC office |
| `face_match_failed` | Selfie score < 0.75 | Allow 2 retries, then manual review queue |
| `provider_timeout` | Prembly/Paystack 5xx | Automatic failover to secondary provider |
| `rate_limit_exceeded` | R5 limit hit | HTTP 429, `Retry-After` header |
| `consent_missing` | P10 violation | Redirect to consent screen |

---

## Rate Limiting (R5)

- BVN lookup: **2 requests per user per hour** (stored in `RATE_LIMIT_KV`)
- NIN lookup: **2 requests per user per hour**
- Key format: `rate_limit:bvn_lookup:{user_id}:{hour_bucket}`

Three consecutive `bvn_mismatch` errors trigger a 24-hour lockout and an alert to the compliance team.

---

## CAC & FRSC (Business/Transport Verticals)

See `docs/identity/frsc-cac-integration.md` for CAC (business registration) and FRSC (transport license) verification flows.
