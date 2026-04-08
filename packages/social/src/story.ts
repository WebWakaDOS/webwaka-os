/**
 * Social stories — 24h ephemeral content.
 * T3 — every query carries tenant_id predicate.
 * Stories expire 24 hours after creation (TTL = 86400 seconds).
 */

import { classifyContent } from './moderation.js';

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

export const STORY_TTL_SECONDS = 86400;

export interface Story {
  id: string;
  tenantId: string;
  authorId: string;
  content: string;
  postType: 'story';
  mediaUrls: string[];
  moderationStatus: string;
  expiresAt: number;
  createdAt: number;
}

interface StoryRow {
  id: string;
  tenant_id: string;
  author_id: string;
  content: string;
  post_type: string;
  media_urls: string;
  moderation_status: string;
  expires_at: number | null;
  created_at: number;
}

function rowToStory(row: StoryRow): Story {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    authorId: row.author_id,
    content: row.content,
    postType: 'story',
    mediaUrls: JSON.parse(row.media_urls) as string[],
    moderationStatus: row.moderation_status,
    expiresAt: row.expires_at ?? row.created_at + STORY_TTL_SECONDS,
    createdAt: row.created_at,
  };
}

/**
 * Returns the number of seconds remaining before a story expires.
 * Returns 0 if the story has already expired.
 */
export function storyTimeRemaining(createdAtUnix: number): number {
  const expiresAt = createdAtUnix + STORY_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, expiresAt - now);
}

/**
 * Create a story post.
 * P15 — classifyContent called before insert.
 * Expires after STORY_TTL_SECONDS (24h).
 */
export async function createStory(
  db: D1Like,
  args: {
    authorId: string;
    content: string;
    mediaUrls?: string[];
    tenantId: string;
  },
): Promise<Story> {
  const { authorId, content, mediaUrls = [], tenantId } = args;

  const moderation = classifyContent(content);

  const id = `story_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + STORY_TTL_SECONDS;
  const mediaUrlsJson = JSON.stringify(mediaUrls);

  await db
    .prepare(
      'INSERT INTO social_posts (id, tenant_id, author_id, content, post_type, media_urls, moderation_status, like_count, comment_count, is_deleted, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)',
    )
    .bind(id, tenantId, authorId, content, 'story', mediaUrlsJson, moderation.status, expiresAt, now)
    .run();

  return {
    id,
    tenantId,
    authorId,
    content,
    postType: 'story',
    mediaUrls,
    moderationStatus: moderation.status,
    expiresAt,
    createdAt: now,
  };
}

/**
 * Get active (non-expired) stories for a tenant.
 * T3 — tenant_id scoped. Excludes deleted and expired stories.
 */
export async function getActiveStories(
  db: D1Like,
  tenantId: string,
  limit = 50,
): Promise<Story[]> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      `SELECT * FROM social_posts
       WHERE tenant_id = ?
         AND post_type = 'story'
         AND is_deleted = 0
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(tenantId, now, limit)
    .all<StoryRow>();

  return result.results.map(rowToStory);
}
