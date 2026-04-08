/**
 * Community membership management.
 * P10 — NDPR consent (data_type = 'community_membership') required before joinCommunity.
 * T3 — every query carries tenant_id predicate.
 * T4 — membership tier prices stored as integer kobo.
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

export interface CommunityMembership {
  id: string;
  tenantId: string;
  communityId: string;
  userId: string;
  tierId: string;
  status: 'active' | 'left' | 'banned';
  kycTier: number;
  joinedAt: number;
  expiresAt: number | null;
}

interface MembershipRow {
  id: string;
  tenant_id: string;
  community_id: string;
  user_id: string;
  tier_id: string;
  status: string;
  kyc_tier: number;
  joined_at: number;
  expires_at: number | null;
}

function rowToMembership(row: MembershipRow): CommunityMembership {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    communityId: row.community_id,
    userId: row.user_id,
    tierId: row.tier_id,
    status: row.status as 'active' | 'left' | 'banned',
    kycTier: row.kyc_tier,
    joinedAt: row.joined_at,
    expiresAt: row.expires_at,
  };
}

export interface JoinCommunityArgs {
  communityId: string;
  userId: string;
  tierId: string;
  kycTier: number;
  tenantId: string;
}

/**
 * Join a community.
 * P10 — throws NDPR_CONSENT_REQUIRED if no active community_membership consent row exists.
 */
export async function joinCommunity(
  db: D1Like,
  args: JoinCommunityArgs,
): Promise<CommunityMembership> {
  const { communityId, userId, tierId, kycTier, tenantId } = args;

  const consent = await db
    .prepare(
      `SELECT id FROM consent_records
       WHERE user_id = ? AND tenant_id = ? AND data_type = 'community_membership'
       AND revoked_at IS NULL LIMIT 1`,
    )
    .bind(userId, tenantId)
    .first<{ id: string }>();

  if (!consent) {
    throw new Error('NDPR_CONSENT_REQUIRED');
  }

  const id = `mb_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO community_memberships (id, tenant_id, community_id, user_id, tier_id, status, kyc_tier, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, tenantId, communityId, userId, tierId, 'active', kycTier, now)
    .run();

  return {
    id,
    tenantId,
    communityId,
    userId,
    tierId,
    status: 'active',
    kycTier,
    joinedAt: now,
    expiresAt: null,
  };
}

export async function getMembership(
  db: D1Like,
  userId: string,
  communityId: string,
  tenantId: string,
): Promise<CommunityMembership | null> {
  const row = await db
    .prepare(
      'SELECT * FROM community_memberships WHERE user_id = ? AND community_id = ? AND tenant_id = ?',
    )
    .bind(userId, communityId, tenantId)
    .first<MembershipRow>();

  return row ? rowToMembership(row) : null;
}

export async function leaveCommunity(
  db: D1Like,
  userId: string,
  communityId: string,
  tenantId: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE community_memberships SET status = 'left' WHERE user_id = ? AND community_id = ? AND tenant_id = ?",
    )
    .bind(userId, communityId, tenantId)
    .run();
}

export interface CreateMembershipTierArgs {
  communityId: string;
  name: string;
  priceKobo: number;
  billingInterval?: 'free' | 'monthly' | 'annually';
  maxMembers?: number;
  tenantId: string;
}

export interface CommunityMembershipTier {
  id: string;
  tenantId: string;
  communityId: string;
  name: string;
  priceKobo: number;
  billingInterval: string;
  maxMembers: number;
  createdAt: number;
}

/**
 * Create a membership tier.
 * T4 — priceKobo must be a non-negative integer.
 */
export async function createMembershipTier(
  db: D1Like,
  args: CreateMembershipTierArgs,
): Promise<CommunityMembershipTier> {
  const { communityId, name, priceKobo, billingInterval = 'free', maxMembers = -1, tenantId } = args;

  if (!Number.isInteger(priceKobo) || priceKobo < 0) {
    throw new Error('T4_VIOLATION: priceKobo must be a non-negative integer');
  }

  const id = `tier_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      'INSERT INTO community_membership_tiers (id, tenant_id, community_id, name, price_kobo, billing_interval, max_members, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, tenantId, communityId, name, priceKobo, billingInterval, maxMembers, now)
    .run();

  return { id, tenantId, communityId, name, priceKobo, billingInterval, maxMembers, createdAt: now };
}
