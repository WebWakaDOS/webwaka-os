/**
 * Social feed — home feed and explore.
 * T3 — every query carries tenant_id predicate.
 * Feed includes posts from followed users + own posts.
 */

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

export interface FeedPost {
  id: string;
  tenantId: string;
  authorId: string;
  content: string;
  postType: string;
  mediaUrls: string[];
  moderationStatus: string;
  likeCount: number;
  createdAt: number;
}

interface FeedPostRow {
  id: string;
  tenant_id: string;
  author_id: string;
  content: string;
  post_type: string;
  media_urls: string;
  moderation_status: string;
  like_count: number;
  created_at: number;
}

function rowToFeedPost(row: FeedPostRow): FeedPost {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    authorId: row.author_id,
    content: row.content,
    postType: row.post_type,
    mediaUrls: JSON.parse(row.media_urls) as string[],
    moderationStatus: row.moderation_status,
    likeCount: row.like_count,
    createdAt: row.created_at,
  };
}

export interface GetUserFeedOptions {
  tenantId: string;
  limit?: number;
  offset?: number;
}

/**
 * Get the home feed for a user.
 * T3 — tenant_id scoped. Excludes deleted posts.
 * Returns posts from followed users + own posts, ordered by created_at DESC.
 */
export async function getUserFeed(
  db: D1Like,
  userId: string,
  options: GetUserFeedOptions,
): Promise<FeedPost[]> {
  const { tenantId, limit = 20, offset = 0 } = options;

  const result = await db
    .prepare(
      `SELECT sp.* FROM social_posts sp
       WHERE sp.tenant_id = ?
         AND sp.is_deleted = 0
         AND sp.post_type = 'post'
         AND (
           sp.author_id = ?
           OR sp.author_id IN (
             SELECT followee_id FROM social_follows
             WHERE follower_id = ? AND tenant_id = ?
           )
         )
       ORDER BY sp.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(tenantId, userId, userId, tenantId, limit, offset)
    .all<FeedPostRow>();

  return result.results.map(rowToFeedPost);
}
