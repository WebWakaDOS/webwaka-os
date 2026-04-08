/**
 * @webwaka/social
 *
 * Social network platform for WebWaka OS.
 * Entities: SocialProfile, Follow, SocialPost, SocialGroup, DMThread, DMMessage, Reaction
 *
 * See docs/social/ for full specification:
 * - social-graph.md       — follow/block/mute/group model
 * - feed-algorithm.md     — home + explore + trending feeds
 * - social-moderation.md  — AI classifier + human review queue
 * - dm-privacy.md         — DM encryption contracts
 * - stories-spec.md       — 24h ephemeral content
 *
 * Nigeria-specific features:
 * - Verification badge gated on NIN/BVN (packages/identity)
 * - Naija Pidgin (pcm) post labelling
 * - USSD trending feed (*384# → 3)
 * - Offline feed cache (Dexie.js, last 50 posts in IndexedDB)
 */

// TODO M7d — Implement:
// - packages/social/src/entities/ (SocialProfile, Follow, SocialPost, etc.)
// - packages/social/src/migrations/ (0029–0034)
// - packages/social/src/feed/ (home-feed.ts, explore-feed.ts, trending.ts)
// - packages/social/src/routes/ (API handlers /social/*)
// - packages/social/src/moderation.ts (AI classifier integration)
// - packages/social/src/dm/ (thread-manager.ts, message-encryptor.ts)
// - packages/social/src/stories/ (stories-ttl-cleanup.ts via scheduled cron)
// - packages/social/src/verification-badge.ts (BVN/NIN gated)
// - packages/social/src/ussd-feed.ts (USSD trending endpoint)

export { SOCIAL_STUB_VERSION } from './stub';
