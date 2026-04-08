/**
 * @webwaka/community
 *
 * Skool-style community platform for WebWaka OS.
 * Entities: CommunitySpace, CommunityMembership, CommunityChannel,
 *           ForumThread, CourseModule, CommunityEvent
 *
 * See docs/community/ for full specification:
 * - community-model.md     — entity model
 * - skool-features.md      — feature set
 * - community-entitlements.md — KYC + subscription gating
 * - community-moderation.md   — content moderation pipeline
 * - community-monetization.md — payments + revenue split
 */

// TODO M7c — Implement:
// - packages/community/src/entities/ (all 6 entity types)
// - packages/community/src/migrations/ (0025–0028)
// - packages/community/src/routes/ (API handlers)
// - packages/community/src/moderation.ts
// - packages/community/src/moderation-config.ts
// - packages/community/src/membership-payment.ts (KYC gating)
// - packages/community/src/broadcast-dm.ts
// - packages/community/src/offline-cache.ts (Service Worker strategy)

export { COMMUNITY_STUB_VERSION } from './stub';
