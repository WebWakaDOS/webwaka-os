# FRSC & CAC Integration Guide

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Nigeria Platform Hardening (M7a)
**Date:** 2026-04-08

---

## Overview

WebWaka OS integrates with two Nigerian regulatory databases for business and transport vertical compliance:

- **CAC (Corporate Affairs Commission):** Business registration verification for organisations activating commercial workspace features.
- **FRSC (Federal Road Safety Commission):** Driver's license / operator license verification for transport sector operators.

Both are managed via the `packages/identity` abstraction layer and require NDPR consent before any lookup.

---

## CAC — Corporate Affairs Commission

### Purpose

CAC verification confirms that an Organisation entity has a valid Nigerian business registration. Required for:
- Organisations claiming a workspace with `type = 'business'`
- Enabling Tier 3 KYC via business registration (instead of NIN)
- Activating e-commerce or financial services modules

### RC Number Format

- **Limited companies:** RC-XXXXXXXX (8 digits)
- **Business names:** BN-XXXXXXXXXX (10 digits)
- **Incorporated Trustees (NGOs/churches):** IT-XXXXXXXX (8 digits)

### Verification Flow

```
Workspace owner enters RC Number
  → NDPR consent check (data_type: 'CAC') 
  → Prembly CAC verification API call
    → Success: { company_name, rc_number, status: 'active'|'inactive', directors: [...] }
    → Match workspace name → verify
    → Mismatch → Show returned name, ask user to confirm or re-enter
  → On success: organisation.cac_verified = true, kyc_tier = 3
  → Audit log: cac_verified event
```

### API Reference (Prembly)

```
POST https://api.prembly.com/identitypass/verification/business/cac
{
  "rc_number": "RC-12345678",
  "company_type": "limited" | "business_name" | "incorporated_trustees"
}

Response:
{
  "status": true,
  "detail": {
    "company_name": "WAKA LOGISTICS LTD",
    "rc_number": "RC-12345678",
    "registration_date": "2021-05-14",
    "status": "active",
    "address": "...",
    "directors": [...]
  }
}
```

**Secret:** `PREMBLY_API_KEY` (shared with BVN/NIN — same Prembly account)

### Rate Limiting

- 5 CAC lookups per workspace per hour (stored in `RATE_LIMIT_KV`)
- Key: `rate_limit:cac_lookup:{workspace_id}:{hour_bucket}`

---

## FRSC — Federal Road Safety Commission

### Purpose

FRSC verification confirms a driver's license or vehicle operator license. Required for:
- Transport vertical operators (bus companies, haulage, ride-hailing) activating route management
- Drivers registering as agents in the transport network

### License Number Format

- Standard driver's license: `AAA00000000000` (3 letters + 11 digits)
- Commercial vehicle license: follows state-specific formats (Lagos: `LA-000000000`)

### Verification Flow

```
Transport operator enters license number
  → NDPR consent check (data_type: 'FRSC')
  → Prembly FRSC verification API call
    → Success: { name, license_number, expiry_date, vehicle_class, status }
    → Expired license → Warn user, still verify identity but flag as expired
    → Not found → Error: "License not found in FRSC database"
  → On success: operator.frsc_verified = true, expiry_date stored
  → Scheduled check: 30 days before expiry → SMS reminder to operator
```

### API Reference (Prembly)

```
POST https://api.prembly.com/identitypass/verification/government-data/frsc
{
  "license_number": "AAA00000000000"
}

Response:
{
  "status": true,
  "detail": {
    "full_name": "JOHN DOE",
    "license_no": "AAA00000000000",
    "issue_date": "2020-01-15",
    "expiry_date": "2025-01-14",
    "vehicle_class": ["B", "C"],
    "status": "valid" | "expired" | "suspended"
  }
}
```

### Expiry Monitoring

Automated expiry checks run via scheduled automation:
- **90 days before expiry:** In-app notification
- **30 days before expiry:** SMS via `packages/otp`
- **On expiry:** Operator flagged, route management module restricted until renewed
- **Automation:** `cron 0 8 * * * UTC` — daily 8am UTC check

---

## Shared Rules

| Rule | CAC | FRSC |
|---|---|---|
| NDPR consent required (P10) | ✅ | ✅ |
| Never log raw RC/license number (R7) | ✅ | ✅ |
| Rate limiting (R5) | ✅ | ✅ |
| All results via `packages/identity` abstraction | ✅ | ✅ |
| Prembly failover (manual queue) | ✅ | ✅ |
| KYC tier upgrade on success | Tier 3 (business) | Tier 3 (transport) |

---

## Cross-Reference

| Doc | Relevance |
|---|---|
| `docs/identity/bvn-nin-guide.md` | Same packages/identity pattern |
| `docs/enhancements/m7/kyc-compliance.md` | Full KYC strategy |
| `docs/enhancements/m7/cbn-kyc-tiers.md` | Tier 3 requirements |
| `docs/enhancements/m7/ndpr-consent.md` | Consent before every lookup |
