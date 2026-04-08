# Community Platform Entitlements

**Status:** Draft — M7 Governance Baseline
**Author:** Base44 Super Agent (Milestone 7)
**Milestone:** M7 — Full Platform + Community/Social
**Date:** 2026-04-08

---

## Overview

Community entitlements extend the core entitlement model (`docs/governance/entitlement-model.md`) with community-specific dimensions. All community access decisions route through `@packages/entitlements` — no hardcoded plan checks in community feature code (Platform Invariant T5).

---

## Entitlement Dimensions (Community Extension)

| Dimension | Description |
|---|---|
| `community.enabled` | Whether this workspace can activate a CommunitySpace |
| `community.max_members` | Maximum simultaneous members |
| `community.max_courses` | Maximum published CourseModules |
| `community.max_channels` | Maximum CommunityChannels |
| `community.max_events` | Maximum active CommunityEvents |
| `community.paid_tiers` | Whether paid membership tiers can be configured |
| `community.analytics` | Access to member + content analytics |
| `community.broadcast` | Whether owner can send broadcast DMs |
| `community.white_label` | Whether Brand Surface is fully unbranded (no WebWaka badge) |

---

## Workspace Subscription Tiers

| Plan | community.enabled | max_members | max_courses | max_channels | paid_tiers | analytics | broadcast |
|---|---|---|---|---|---|---|---|
| **Starter** | ✅ | 50 | 1 | 3 | ❌ | ❌ | ❌ |
| **Growth** | ✅ | 500 | 10 | 20 | ✅ | Basic | ✅ |
| **Scale** | ✅ | Unlimited | Unlimited | Unlimited | ✅ | Full | ✅ |
| **Enterprise** | ✅ | Unlimited | Unlimited | Unlimited | ✅ | Full + Export | ✅ |

---

## KYC Tier Gating (CBN Compliance)

All paid community memberships must enforce CBN KYC tier gating at point of payment:

| Membership Price (Annual) | Minimum KYC Tier Required |
|---|---|
| Free | None |
| ₦1 – ₦49,999 | Tier 1 (Phone + Name) |
| ₦50,000 – ₦199,999 | Tier 2 (BVN + Address) |
| ₦200,000+ | Tier 3 (BVN + NIN + Face Match) |

Implementation: `requireKYCTier(ctx, minTier)` from `@packages/entitlements/kyc-tiers.ts`.

---

## Access Evaluation Sequence

For every community feature access request:

```
1. Is community.enabled for this workspace? → else 403
2. Is the user a CommunityMember? → else redirect to join flow
3. Does the user's membership tier satisfy the channel/course access_tier? → else upsell
4. For paid actions: does the user's KYC tier satisfy the price bracket? → else KYC prompt
5. Is content flagged by moderation? → else 451 (legal / moderation hold)
6. Is the workspace subscription active (not expired/suspended)? → else 402
```

---

## NDPR Compliance Requirements

Before collecting any member data:

1. Consent record must exist in `consent_records` table with `data_type = 'community_membership'`.
2. For paid tiers: additional consent record for `data_type = 'payment_data'`.
3. For KYC-gated tiers: consent record for `data_type = 'BVN'` or `data_type = 'NIN'` as applicable.
4. Consent must be purpose-specific — joining a community is a separate consent from receiving marketing.

---

## Invariant Cross-Reference

| Invariant | Application to Community Entitlements |
|---|---|
| T5 — Subscription-Gated | All community access uses `@packages/entitlements` guards |
| P2 — Nigeria First | CBN KYC tier gating on all paid memberships |
| T3 — Tenant Isolation | All community queries scoped by `tenant_id` |
| T4 — Monetary Integrity | Membership prices stored as integer kobo |
