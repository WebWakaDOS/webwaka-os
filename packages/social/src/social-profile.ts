/**
 * Social profiles.
 * T3 — every query carries tenant_id predicate.
 * Handles: must be lowercase alphanumeric + underscores.
 * HANDLE_TAKEN: 409 if duplicate handle in same tenant.
 */

export interface D1Like {
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

export interface SocialProfile {
  id: string;
  tenantId: string;
  profileId: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  createdAt: number;
}

interface ProfileRow {
  id: string;
  tenant_id: string;
  profile_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  is_verified: number;
  follower_count: number;
  following_count: number;
  created_at: number;
}

function rowToProfile(row: ProfileRow): SocialProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    profileId: row.profile_id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    phoneNumber: row.phone_number,
    avatarUrl: row.avatar_url,
    isVerified: row.is_verified === 1,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    createdAt: row.created_at,
  };
}

const HANDLE_REGEX = /^[a-z0-9_]{2,30}$/;

export interface SetupSocialProfileArgs {
  profileId: string;
  handle: string;
  displayName?: string;
  bio?: string;
  phoneNumber?: string;
  tenantId: string;
}

/**
 * Set up a social profile.
 * Throws HANDLE_TAKEN if the handle already exists in the tenant.
 * Throws VALIDATION if the handle format is invalid.
 */
export async function setupSocialProfile(
  db: D1Like,
  args: SetupSocialProfileArgs,
): Promise<SocialProfile> {
  const { profileId, handle, displayName, bio, phoneNumber, tenantId } = args;

  if (!HANDLE_REGEX.test(handle)) {
    throw new Error(
      'VALIDATION: handle must be 2-30 lowercase alphanumeric characters or underscores',
    );
  }

  const existing = await db
    .prepare('SELECT id FROM social_profiles WHERE handle = ? AND tenant_id = ?')
    .bind(handle, tenantId)
    .first<{ id: string }>();

  if (existing) {
    throw new Error('HANDLE_TAKEN');
  }

  const id = `sp_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO social_profiles (id, tenant_id, profile_id, handle, display_name, bio, phone_number, avatar_url, is_verified, follower_count, following_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, 0, ?)',
    )
    .bind(
      id,
      tenantId,
      profileId,
      handle,
      displayName ?? null,
      bio ?? null,
      phoneNumber ?? null,
      now,
    )
    .run();

  return {
    id,
    tenantId,
    profileId,
    handle,
    displayName: displayName ?? null,
    bio: bio ?? null,
    phoneNumber: phoneNumber ?? null,
    avatarUrl: null,
    isVerified: false,
    followerCount: 0,
    followingCount: 0,
    createdAt: now,
  };
}

export async function getSocialProfileByHandle(
  db: D1Like,
  handle: string,
  tenantId: string,
): Promise<SocialProfile | null> {
  const row = await db
    .prepare('SELECT * FROM social_profiles WHERE handle = ? AND tenant_id = ?')
    .bind(handle, tenantId)
    .first<ProfileRow>();

  return row ? rowToProfile(row) : null;
}

export async function getSocialProfileByPhone(
  db: D1Like,
  phoneNumber: string,
  tenantId: string,
): Promise<SocialProfile | null> {
  const row = await db
    .prepare('SELECT * FROM social_profiles WHERE phone_number = ? AND tenant_id = ? LIMIT 1')
    .bind(phoneNumber, tenantId)
    .first<ProfileRow>();

  return row ? rowToProfile(row) : null;
}
