# Community Monetization

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Full Platform + Community/Social
**Date:** 2026-04-08

---

## Overview

WebWaka communities can generate revenue through multiple monetization models, all gated by subscription entitlements and CBN KYC compliance. Monetization flows route through `packages/payments` (Paystack primary / Flutterwave failover) and enforce Platform Invariant T4 (monetary integrity: integer kobo).

---

## Monetization Models

### 1. Paid Membership Tiers

Community owners configure 1–N membership tiers with individual pricing:

| Field | Type | Notes |
|---|---|---|
| `tier_name` | TEXT | e.g. "Free", "Pro Member", "VIP" |
| `price_kobo` | INTEGER | Monthly price in kobo (₦0 = free) |
| `billing_cycle` | ENUM | `monthly` \| `annual` |
| `access_channels` | JSON | Array of `CommunityChannel.id` this tier unlocks |
| `access_courses` | JSON | Array of `CourseModule.id` this tier unlocks |
| `kyc_tier_required` | INTEGER | Minimum CBN KYC tier (0–3) |

**KYC gating:**
- ₦1–₦49,999/year → Tier 1 minimum (phone + name)
- ₦50,000–₦199,999/year → Tier 2 minimum (BVN + address)
- ₦200,000+/year → Tier 3 minimum (BVN + NIN)

### 2. One-Time Course Access

Individual CourseModules can be sold as one-time purchases (no recurring billing).

### 3. Event Tickets

CommunityEvents can require ticket purchase via `packages/payments`. Tickets are Offerings in the universal entity model.

### 4. Community Donations / Tips

Members can tip creators directly. Tips are processed as single Paystack charges. No recurring contract.

---

## Payment Flow

```
Member clicks "Join paid tier"
  → KYC tier check (requireKYCTier)
    → Insufficient tier → KYC upgrade prompt (docs/identity/bvn-nin-guide.md)
  → NDPR consent check (consent_records)
    → No consent → Consent screen (data_type: payment_data)
  → Paystack Checkout initiated
    → Success → CommunityMembership record created / upgraded
    → Failure → Error displayed, no membership change
  → Webhook: paystack.charge.success
    → Idempotency check (R6)
    → Subscription sync (packages/payments/subscription-sync.ts)
    → Member entitlement refreshed
```

---

## Revenue Split

| Party | Share | Notes |
|---|---|---|
| Community Owner | Configurable (default 85%) | Set in workspace billing settings |
| WebWaka Platform | Configurable (default 10%) | Platform fee |
| Paystack / Gateway | ~1.5% (capped ₦2,000) | Transaction processing fee |
| Partner (if white-label) | Configurable (default 5%) | Only if workspace is under a partner |

Splits are processed via Paystack Split Payment API. See `packages/payments/split.ts` (M7 deliverable).

---

## Payouts

- Community owners receive payouts to their registered Nigerian bank account.
- Payout frequency: weekly (default) or on-demand (Scale / Enterprise plans).
- Payout threshold: minimum ₦5,000 pending balance.
- Payout requires Tier 2 KYC minimum for the workspace owner.

---

## Invariant Cross-Reference

| Invariant | Application |
|---|---|
| T4 — Monetary Integrity | All prices/payouts in integer kobo |
| P9 — Agent Float Ledger | Float top-ups via POS agent are also split-tracked |
| P10 — BVN/NIN Consent | KYC required before ₦50k+ transactions |
| T5 — Subscription-Gated | `community.paid_tiers` entitlement must be active |
