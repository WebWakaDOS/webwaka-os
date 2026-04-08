/**
 * Social follow graph.
 * T3 — every query carries tenant_id predicate.
 * SELF_FOLLOW guard: follower must not equal followee.
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

export interface SocialFollow {
  id: string;
  tenantId: string;
  followerId: string;
  followeeId: string;
  createdAt: number;
}

interface FollowRow {
  id: string;
  tenant_id: string;
  follower_id: string;
  followee_id: string;
  created_at: number;
}

function rowToFollow(row: FollowRow): SocialFollow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    followerId: row.follower_id,
    followeeId: row.followee_id,
    createdAt: row.created_at,
  };
}

export interface FollowProfileArgs {
  followerId: string;
  followeeId: string;
  tenantId: string;
}

/**
 * Follow a profile.
 * Throws SELF_FOLLOW if followerId === followeeId.
 * Throws ALREADY_FOLLOWING if the follow already exists.
 */
export async function followProfile(
  db: D1Like,
  args: FollowProfileArgs,
): Promise<SocialFollow> {
  const { followerId, followeeId, tenantId } = args;

  if (followerId === followeeId) {
    throw new Error('SELF_FOLLOW');
  }

  const existing = await db
    .prepare(
      'SELECT id FROM social_follows WHERE follower_id = ? AND followee_id = ? AND tenant_id = ?',
    )
    .bind(followerId, followeeId, tenantId)
    .first<{ id: string }>();

  if (existing) {
    throw new Error('ALREADY_FOLLOWING');
  }

  const id = `follow_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO social_follows (id, tenant_id, follower_id, followee_id, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, tenantId, followerId, followeeId, now)
    .run();

  return { id, tenantId, followerId, followeeId, createdAt: now };
}

export async function unfollowProfile(
  db: D1Like,
  followerId: string,
  followeeId: string,
  tenantId: string,
): Promise<void> {
  await db
    .prepare(
      'DELETE FROM social_follows WHERE follower_id = ? AND followee_id = ? AND tenant_id = ?',
    )
    .bind(followerId, followeeId, tenantId)
    .run();
}

export async function getFollowers(
  db: D1Like,
  profileId: string,
  tenantId: string,
): Promise<SocialFollow[]> {
  const result = await db
    .prepare(
      'SELECT * FROM social_follows WHERE followee_id = ? AND tenant_id = ? ORDER BY created_at DESC',
    )
    .bind(profileId, tenantId)
    .all<FollowRow>();

  return result.results.map(rowToFollow);
}

export async function getFollowing(
  db: D1Like,
  profileId: string,
  tenantId: string,
): Promise<SocialFollow[]> {
  const result = await db
    .prepare(
      'SELECT * FROM social_follows WHERE follower_id = ? AND tenant_id = ? ORDER BY created_at DESC',
    )
    .bind(profileId, tenantId)
    .all<FollowRow>();

  return result.results.map(rowToFollow);
}
