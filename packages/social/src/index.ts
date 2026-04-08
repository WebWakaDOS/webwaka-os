/**
 * @webwaka/social — Social Network for WebWaka OS.
 * Milestone 7c.
 *
 * Invariants enforced:
 *   T3 — all DB queries scoped by tenant_id
 *   P14 — DM content encrypted with AES-GCM, DM_MASTER_KEY required
 *   P15 — classifyContent called before every post insert
 */

export type { SocialProfile, SetupSocialProfileArgs } from './social-profile.js';
export {
  setupSocialProfile,
  getSocialProfileByHandle,
  getSocialProfileByPhone,
} from './social-profile.js';

export type { SocialFollow, FollowProfileArgs } from './follow.js';
export { followProfile, unfollowProfile, getFollowers, getFollowing } from './follow.js';

export type { SocialPost, SocialReaction, CreatePostArgs, PostType, ReactionType } from './social-post.js';
export { createPost, getPost, reactToPost } from './social-post.js';

export type { FeedPost, GetUserFeedOptions } from './feed.js';
export { getUserFeed } from './feed.js';

export type { DMThread, DMMessage } from './dm.js';
export {
  assertDMMasterKey,
  createDMThread,
  sendDM,
  getDMThreads,
  getDMMessages,
  decryptDMContent,
} from './dm.js';

export type { Story } from './story.js';
export { createStory, getActiveStories, storyTimeRemaining, STORY_TTL_SECONDS } from './story.js';

export type { ModerationResult, ModerationStatus } from './moderation.js';
export { classifyContent } from './moderation.js';
