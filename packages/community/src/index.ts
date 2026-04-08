/**
 * @webwaka/community — Community Platform (Skool-style) for WebWaka OS.
 * Milestone 7c.
 *
 * Invariants enforced:
 *   T3 — all DB queries scoped by tenant_id
 *   T4 — all monetary values as integer kobo
 *   T5 — paid tiers / courses gated by entitlement plan
 *   P10 — NDPR consent required before joinCommunity
 *   P15 — classifyContent called before every post insert
 */

export type { CommunitySpace, CreateCommunitySpaceArgs } from './space.js';
export { createCommunitySpace, getCommunitySpace, listSpaces } from './space.js';

export type {
  CommunityMembership,
  CommunityMembershipTier,
  JoinCommunityArgs,
  CreateMembershipTierArgs,
} from './membership.js';
export {
  joinCommunity,
  getMembership,
  leaveCommunity,
  createMembershipTier,
} from './membership.js';

export type { CommunityChannel, ChannelPost, CreateChannelArgs, CreateChannelPostArgs } from './channel.js';
export { createChannel, listChannels, createChannelPost, listChannelPosts } from './channel.js';

export type { CourseModule, CourseLesson, LessonProgress } from './course.js';
export {
  createCourseModule,
  getCourseModules,
  createCourseLesson,
  getLessonById,
  recordLessonProgress,
} from './course.js';

export type { CommunityEvent, CreateEventArgs, EventRsvp } from './event.js';
export { createEvent, listEvents, rsvpToEvent } from './event.js';

export type { ModerationResult, ModerationStatus } from './moderation.js';
export { classifyContent } from './moderation.js';

export type { CommunityEntitlements } from './entitlements.js';
export {
  FREE_COMMUNITY_ENTITLEMENTS,
  PRO_COMMUNITY_ENTITLEMENTS,
  ENTERPRISE_COMMUNITY_ENTITLEMENTS,
  assertPaidTiersEnabled,
  assertCoursesEnabled,
  assertMaxSpaces,
} from './entitlements.js';
