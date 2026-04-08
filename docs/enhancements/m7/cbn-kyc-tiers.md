# CBN KYC Tiers — Transaction Limits & Compliance

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Nigeria Platform Hardening (M7a)
**Date:** 2026-04-08

---

## Regulatory Basis

This document implements the **Central Bank of Nigeria (CBN) Tiered Know-Your-Customer (KYC) Requirements** as defined in:

- CBN KYC Regulations 2013 (as amended 2023)
- CBN Guidelines on Mobile Money Services in Nigeria
- CBN Risk-Based Supervisory Framework

All WebWaka OS transaction flows — wallet top-ups, payments, POS float movements, community memberships — must enforce these tiers.

---

## KYC Tier Definitions

### Tier 0 — Anonymous (No KYC)
- **Verification:** None
- **Daily transaction limit:** ₦0 (no financial transactions permitted)
- **Cumulative balance cap:** ₦0
- **Use case:** Browsing, discovery, creating profile — no payments
- **Notes:** Users at Tier 0 must complete at least Tier 1 before any transaction

### Tier 1 — Basic Identity
- **Verification:** Phone number (OTP confirmed) + Full name
- **Daily transaction limit:** ₦50,000
- **Cumulative balance cap:** ₦300,000/month
- **Wallet balance cap:** ₦300,000
- **Use case:** Small purchases, community memberships < ₦50k/year, airtime top-up
- **Verification provider:** `packages/otp` (Termii / Africa's Talking)

### Tier 2 — Enhanced KYC
- **Verification:** Tier 1 + BVN + Residential address (verified by NIBSS)
- **Daily transaction limit:** ₦200,000
- **Cumulative balance cap:** ₦1,000,000/month
- **Wallet balance cap:** ₦1,000,000
- **Use case:** Medium purchases, premium community memberships, agent float operations
- **Verification provider:** `packages/identity` (Prembly / Paystack Identity for BVN)

### Tier 3 — Full KYC
- **Verification:** Tier 2 + NIN (face match) + Proof of address document **OR** CAC certificate (businesses) **OR** FRSC license (transport operators)
- **Daily transaction limit:** Unlimited
- **Cumulative balance cap:** Unlimited
- **Wallet balance cap:** Unlimited
- **Use case:** High-value transactions, all subscription tiers, business payouts, institutional payments
- **Verification provider:** `packages/identity` (Prembly NIN + NIMC gateway)

---

## Transaction Limit Table (Summary)

| Tier | Daily Send Limit | Monthly Cap | Wallet Balance Cap | Notes |
|---|---|---|---|---|
| 0 | ₦0 | ₦0 | ₦0 | No transactions |
| 1 | ₦50,000 | ₦300,000 | ₦300,000 | Phone + Name only |
| 2 | ₦200,000 | ₦1,000,000 | ₦1,000,000 | BVN required |
| 3 | Unlimited | Unlimited | Unlimited | NIN/CAC/FRSC required |

All amounts are in NGN. Stored internally as integer kobo (multiply by 100).

---

## Enforcement Implementation

```typescript
// packages/entitlements/kyc-tiers.ts
export async function requireKYCTier(
  ctx: RequestContext,
  minTier: 0 | 1 | 2 | 3,
  transactionAmount?: number  // in kobo
): Promise<void> {
  const userTier = await getUserKYCTier(ctx.userId, ctx.tenantId);
  
  if (userTier < minTier) {
    throw new KYCUpgradeRequired({ currentTier: userTier, requiredTier: minTier });
  }
  
  if (transactionAmount) {
    await checkDailyLimit(ctx.userId, transactionAmount, userTier);
  }
}
```

On `KYCUpgradeRequired`, the API returns HTTP 403 with body:
```json
{
  "error": "kyc_upgrade_required",
  "current_tier": 1,
  "required_tier": 2,
  "upgrade_url": "/identity/verify/bvn"
}
```

---

## KYC Upgrade Journey

```
User hits KYC limit
  → 403 response with upgrade_url
  → Frontend routes to KYC upgrade flow
  → User selects document type (BVN / NIN / CAC / FRSC)
  → NDPR consent collected (P10)
  → Document number entered
  → Prembly API verification call
    → Success → kyc_tier updated in users table
    → Failure → Error displayed, retry options shown
  → On upgrade: in-progress transaction can be retried (not auto-retried)
```

---

## Agent Network (POS) KYC Rules

POS agents (human agents with physical terminals) are a special case:
- Agent must be Tier 3 (full KYC) to operate a POS terminal.
- Agent float top-ups follow standard transaction limits of the funding source.
- Customer-facing cash-in/cash-out at POS: KYC tier of the customer governs their limit.
- Float ledger entries must reference the agent's `kyc_tier` at time of transaction.

See `docs/enhancements/m7/agent-network.md` for full POS agent model.

---

## Cross-Reference

| Doc | Section |
|---|---|
| `docs/governance/entitlement-model.md` | CBN KYC Tiers section |
| `docs/enhancements/m7/ndpr-consent.md` | P10 consent before BVN/NIN lookup |
| `docs/identity/bvn-nin-guide.md` | Prembly/Paystack verification APIs |
| `docs/governance/security-baseline.md` | R5 rate limiting for BVN/NIN lookups |
