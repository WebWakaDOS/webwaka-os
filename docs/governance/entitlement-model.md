# Entitlement Model

**Status:** Approved — Milestone 1 Governance Baseline | Updated M7
**Author:** Perplexity (Milestone 1) | Extended by Base44 Super Agent (M7)
**Reviewed by:** Base44 Super Agent
**Founder approved:** ✅ 7 April 2026
**M7 Updated:** 2026-04-08

---

## Core Rule

Subscription is the final determinant of what any person, organization, partner, or place can access, manage, publish, brand, delegate, or monetize.

## Entitlement Dimensions

| Dimension | Description |
|---|---|
| Active layers | Which platform layers are unlocked |
| Active modules | Which sector modules are enabled |
| User limits | Maximum team members in a workspace |
| Branch/place limits | Maximum managed Places |
| Offering limits | Maximum active Offerings |
| Branding rights | Whether a Brand Surface can be activated |
| White-label depth | Whether partner-level branding is permitted |
| Delegation rights | Whether sub-partners may be created |
| Visibility rights | Discovery index status and featured placement |
| AI rights | Which AI capabilities are accessible |
| Sensitive-sector rights | Whether regulated modules can be activated |
| Community rights | Community platform dimensions (see below) |
| Social rights | Social network dimensions (see below) |
| KYC tier | CBN-regulated transaction limit tier (see below) |

## Access Evaluation

Every access decision must consider:

1. Root entity type
2. Workspace membership
3. Role
4. Claim or verification state
5. Subscription plan
6. Feature entitlements
7. Geography scope where relevant
8. **KYC tier (for monetary actions)** ← M7 addition

## Examples

- A claimed profile may exist without a paid workspace.
- A workspace may exist without white-label rights.
- A partner may onboard sub-partners only if delegation rights are included in subscription.
- Political or regulated modules may require verification even when paid for.
- **A user may not initiate a transaction above their CBN KYC tier daily limit.** ← M7

---

## M7 Addition: CBN KYC Tiers

Nigeria's Central Bank of Nigeria (CBN) mandates tiered KYC for all digital financial services. All transaction flows in WebWaka OS must enforce these tiers at the point of payment.

### KYC Tier Definitions

| Tier | Requirements | Daily Transaction Limit | Cumulative Monthly Limit |
|---|---|---|---|
| **Tier 0** | None — anonymous browsing | ₦0 (no transactions) | ₦0 |
| **Tier 1** | Phone number + Full name verified | ₦50,000/day | ₦300,000/month |
| **Tier 2** | BVN + Residential address | ₦200,000/day | ₦1,000,000/month |
| **Tier 3** | BVN + NIN + Proof of address (or CAC/FRSC for entities) | Unlimited | Unlimited |

### Enforcement Rules

- `requireKYCTier(ctx, minTier)` from `@packages/entitlements/kyc-tiers.ts` must gate every monetary action.
- Tier is evaluated per-user per-transaction — not cached beyond request scope.
- Downgrading KYC tier is not permitted. Once a higher tier is verified, it is permanent until explicit revocation by compliance team.
- BVN lookups require prior NDPR consent (`consent_records.data_type = 'BVN'`). See `docs/enhancements/m7/ndpr-consent.md`.
- NIN lookups require prior NDPR consent (`consent_records.data_type = 'NIN'`).

### Tier Verification Providers

| Document | Provider | Package |
|---|---|---|
| BVN | Prembly / Paystack Identity | `packages/identity` |
| NIN | Prembly / NIMC gateway | `packages/identity` |
| Phone OTP | Termii / Africa's Talking / WhatsApp | `packages/otp` |
| CAC (business) | CAC open data + Prembly | `packages/identity` |
| FRSC (transport) | FRSC API (transport vertical) | `packages/identity` |

---

## M7 Addition: Community Entitlement Dimensions

See `docs/community/community-entitlements.md` for full detail.

| Dimension | Description |
|---|---|
| `community.enabled` | Whether this workspace can activate a CommunitySpace |
| `community.max_members` | Maximum simultaneous members |
| `community.max_courses` | Maximum published CourseModules |
| `community.paid_tiers` | Whether paid membership tiers can be configured |
| `community.analytics` | Access to member + content analytics |
| `community.broadcast` | Whether owner can send broadcast DMs |

---

## M7 Addition: Social Entitlement Dimensions

| Dimension | Description |
|---|---|
| `social.enabled` | Whether this workspace/user has social profile activated |
| `social.verified_badge` | Whether NIN/BVN blue-tick is displayed |
| `social.boosted_posts` | Whether sponsored feed placement is available |
| `social.dm_enabled` | Whether direct messaging is enabled |
| `social.groups_enabled` | Whether group creation is permitted |
| `social.analytics` | Access to post/follower analytics |
