/**
 * Stories management — 24h ephemeral posts.
 * (Platform Invariants P15 — moderation-first, T3 — tenant isolation)
 */

import type { SocialPost } from './social-post.js';
import type { D1Like } from './social-profile.js';
import { createPost } from './social-post.js';

/**
 * Create a story (post with 24h expiry).
 */
export async function createStory(
  db: D1Like,
  input: {
    authorId: string;
    content: string;
    mediaUrls?: string[];
    language?: 'en' | 'pcm' | 'yo' | 'ig' | 'ha';
    tenantId: string;
  },
): Promise<SocialPost> {
  return createPost(db, {
    ...input,
    postType: 'story',
    visibility: 'followers',
  });
}

/**
 * Get active stories from profiles the user follows.
 * Stories expire after 24h (86400s).
 */
export async function getActiveStories(
  db: D1Like,
  followingIds: string[],
  tenantId: string,
): Promise<SocialPost[]> {
  if (followingIds.length === 0) return [];

  const now = Math.floor(Date.now() / 1000);
  const placeholders = followingIds.map(() => '?').join(', ');

  interface PostRow {
    id: string;
    author_id: string;
    content: string;
    media_urls: string;
    post_type: string;
    parent_id: string | null;
    group_id: string | null;
    visibility: string;
    language: string;
    like_count: number;
    comment_count: number;
    repost_count: number;
    is_flagged: number;
    moderation_status: string;
    is_boosted: number;
    is_deleted: number;
    expires_at: number | null;
    tenant_id: string;
    created_at: number;
  }

  const { results } = await db
    .prepare(
      `SELECT * FROM social_posts
       WHERE author_id IN (${placeholders}) AND tenant_id = ?
         AND post_type = 'story'
         AND expires_at > ?
         AND moderation_status = 'published'
       ORDER BY created_at DESC`,
    )
    .bind(...followingIds, tenantId, now)
    .all<PostRow>();

  return results.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    mediaUrls: JSON.parse(row.media_urls) as string[],
    postType: row.post_type as SocialPost['postType'],
    parentId: row.parent_id,
    groupId: row.group_id,
    visibility: row.visibility as SocialPost['visibility'],
    language: row.language as SocialPost['language'],
    likeCount: row.like_count,
    commentCount: row.comment_count,
    repostCount: row.repost_count,
    isFlagged: row.is_flagged === 1,
    moderationStatus: row.moderation_status as SocialPost['moderationStatus'],
    isBoosted: row.is_boosted === 1,
    isDeleted: row.is_deleted === 1,
    expiresAt: row.expires_at,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
  }));
}

/**
 * Count remaining seconds before a story expires.
 */
export function storyTimeRemaining(expiresAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, expiresAt - now);
}
