/**
 * Social posts and reactions.
 * P15 — classifyContent called unconditionally before every post insert.
 * T3 — every query carries tenant_id predicate.
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

export type PostType = 'post' | 'story' | 'repost';
export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

const VALID_REACTION_TYPES: ReactionType[] = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];

export interface SocialPost {
  id: string;
  tenantId: string;
  authorId: string;
  content: string;
  postType: PostType;
  mediaUrls: string[];
  moderationStatus: 'published' | 'auto_hide' | 'pending_review';
  likeCount: number;
  commentCount: number;
  isDeleted: boolean;
  expiresAt: number | null;
  createdAt: number;
}

interface PostRow {
  id: string;
  tenant_id: string;
  author_id: string;
  content: string;
  post_type: string;
  media_urls: string;
  moderation_status: string;
  like_count: number;
  comment_count: number;
  is_deleted: number;
  expires_at: number | null;
  created_at: number;
}

function rowToPost(row: PostRow): SocialPost {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    authorId: row.author_id,
    content: row.content,
    postType: row.post_type as PostType,
    mediaUrls: JSON.parse(row.media_urls) as string[],
    moderationStatus: row.moderation_status as 'published' | 'auto_hide' | 'pending_review',
    likeCount: row.like_count,
    commentCount: row.comment_count,
    isDeleted: row.is_deleted === 1,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export interface CreatePostArgs {
  authorId: string;
  content: string;
  postType?: PostType;
  mediaUrls?: string[];
  tenantId: string;
}

/**
 * Create a social post.
 * P15 — classifyContent is called unconditionally before the INSERT.
 */
export async function createPost(db: D1Like, args: CreatePostArgs): Promise<SocialPost> {
  const { authorId, content, postType = 'post', mediaUrls = [], tenantId } = args;

  if (!content || content.trim().length === 0) {
    throw new Error('VALIDATION: content must not be empty');
  }

  const moderation = classifyContent(content);

  const id = `post_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);
  const mediaUrlsJson = JSON.stringify(mediaUrls);

  await db
    .prepare(
      'INSERT INTO social_posts (id, tenant_id, author_id, content, post_type, media_urls, moderation_status, like_count, comment_count, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)',
    )
    .bind(id, tenantId, authorId, content, postType, mediaUrlsJson, moderation.status, now)
    .run();

  return {
    id,
    tenantId,
    authorId,
    content,
    postType,
    mediaUrls,
    moderationStatus: moderation.status,
    likeCount: 0,
    commentCount: 0,
    isDeleted: false,
    expiresAt: null,
    createdAt: now,
  };
}

export async function getPost(
  db: D1Like,
  postId: string,
  tenantId: string,
): Promise<SocialPost | null> {
  const row = await db
    .prepare('SELECT * FROM social_posts WHERE id = ? AND tenant_id = ?')
    .bind(postId, tenantId)
    .first<PostRow>();

  return row ? rowToPost(row) : null;
}

export interface SocialReaction {
  id: string;
  tenantId: string;
  postId: string;
  userId: string;
  reactionType: ReactionType;
  createdAt: number;
}

/**
 * React to a post.
 * Throws INVALID_REACTION_TYPE for unknown types.
 */
export async function reactToPost(
  db: D1Like,
  args: { postId: string; userId: string; reactionType: string; tenantId: string },
): Promise<SocialReaction> {
  const { postId, userId, reactionType, tenantId } = args;

  if (!VALID_REACTION_TYPES.includes(reactionType as ReactionType)) {
    throw new Error(
      `INVALID_REACTION_TYPE: must be one of ${VALID_REACTION_TYPES.join(', ')}`,
    );
  }

  const id = `react_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO social_reactions (id, tenant_id, post_id, user_id, reaction_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(id, tenantId, postId, userId, reactionType, now)
    .run();

  if (reactionType === 'like') {
    await db
      .prepare('UPDATE social_posts SET like_count = like_count + 1 WHERE id = ? AND tenant_id = ?')
      .bind(postId, tenantId)
      .run();
  }

  return {
    id,
    tenantId,
    postId,
    userId,
    reactionType: reactionType as ReactionType,
    createdAt: now,
  };
}
