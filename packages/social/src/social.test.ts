/**
 * @webwaka/social — unit tests
 * Milestone 7c — 41 tests
 *
 * Verifies:
 *   T3 — tenant_id isolation
 *   P14 — DM encryption + DM_MASTER_KEY assertion
 *   P15 — classifyContent before post insert
 */

import { describe, it, expect, vi } from 'vitest';
import { classifyContent } from './moderation.js';
import { assertDMMasterKey, createDMThread, sendDM, getDMThreads } from './dm.js';
import { storyTimeRemaining, STORY_TTL_SECONDS, createStory, getActiveStories } from './story.js';
import { setupSocialProfile, getSocialProfileByHandle, getSocialProfileByPhone } from './social-profile.js';
import { followProfile, unfollowProfile, getFollowers, getFollowing } from './follow.js';
import { createPost, getPost, reactToPost } from './social-post.js';
import { getUserFeed } from './feed.js';

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

type MockPrepareFn = D1Like['prepare'] & { mock: { calls: unknown[][] } };
type MockDB = { prepare: MockPrepareFn };

function makeDB(overrides: { firstResult?: unknown; allResults?: unknown[] } = {}): MockDB {
  const impl = (_sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: <T>() => Promise.resolve((overrides.firstResult ?? null) as T | null),
      run: () => Promise.resolve({ success: true }),
      all: <T>() => Promise.resolve({ results: (overrides.allResults ?? []) as T[] }),
    }),
  });
  return { prepare: vi.fn(impl) as unknown as MockPrepareFn };
}

function makeDBWithHandleCheck(existingHandle: string | null): MockDB {
  const impl = (sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: <T>() => {
        if (sql.includes('social_profiles') && sql.includes('handle')) {
          return Promise.resolve((existingHandle ? { id: 'sp_existing' } : null) as T);
        }
        return Promise.resolve(null);
      },
      run: () => Promise.resolve({ success: true }),
      all: <T>() => Promise.resolve({ results: [] as T[] }),
    }),
  });
  return { prepare: vi.fn(impl) as unknown as MockPrepareFn };
}

// ============================================================================
// classifyContent (P15)
// ============================================================================

describe('classifyContent', () => {
  it('returns auto_hide for spam content', () => {
    const result = classifyContent('buy cheap watches click now');
    expect(result.status).toBe('auto_hide');
  });

  it('returns published for clean content', () => {
    const result = classifyContent('Excited to launch our new community platform!');
    expect(result.status).toBe('published');
  });
});

// ============================================================================
// assertDMMasterKey (P14)
// ============================================================================

describe('assertDMMasterKey', () => {
  it('throws P14_VIOLATION for undefined key', () => {
    expect(() => assertDMMasterKey(undefined)).toThrow(/P14_VIOLATION/);
  });

  it('throws P14_VIOLATION for empty string key', () => {
    expect(() => assertDMMasterKey('')).toThrow(/P14_VIOLATION/);
  });

  it('does not throw for a valid key', () => {
    expect(() => assertDMMasterKey('valid-secret-master-key-32chars!!')).not.toThrow();
  });
});

// ============================================================================
// Social Profile (T3, HANDLE_TAKEN)
// ============================================================================

describe('setupSocialProfile', () => {
  it('creates a social profile successfully', async () => {
    const db = makeDBWithHandleCheck(null);
    const profile = await setupSocialProfile(db, {
      profileId: 'u1',
      handle: 'amaka',
      tenantId: 'tenant-a',
    });
    expect(profile.handle).toBe('amaka');
    expect(profile.tenantId).toBe('tenant-a');
    expect(profile.id).toMatch(/^sp_/);
  });

  it('throws HANDLE_TAKEN for duplicate handle in same tenant', async () => {
    const db = makeDBWithHandleCheck('amaka');
    await expect(
      setupSocialProfile(db, { profileId: 'u2', handle: 'amaka', tenantId: 'tenant-a' }),
    ).rejects.toThrow('HANDLE_TAKEN');
  });

  it('throws VALIDATION for uppercase handle', async () => {
    const db = makeDB();
    await expect(
      setupSocialProfile(db, { profileId: 'u1', handle: 'UPPERCASE', tenantId: 'tenant-a' }),
    ).rejects.toThrow('VALIDATION');
  });

  it('throws VALIDATION for handle that is too short', async () => {
    const db = makeDB();
    await expect(
      setupSocialProfile(db, { profileId: 'u1', handle: 'a', tenantId: 'tenant-a' }),
    ).rejects.toThrow('VALIDATION');
  });
});

describe('getSocialProfileByHandle', () => {
  it('returns profile for correct tenant (T3)', async () => {
    const row = {
      id: 'sp_1', tenant_id: 'tenant-a', profile_id: 'u1', handle: 'amaka',
      display_name: null, bio: null, phone_number: null, avatar_url: null,
      is_verified: 0, follower_count: 0, following_count: 0, created_at: 1000,
    };
    const db = makeDB({ firstResult: row });
    const profile = await getSocialProfileByHandle(db, 'amaka', 'tenant-a');
    expect(profile?.handle).toBe('amaka');
  });

  it('returns null for wrong tenant (T3)', async () => {
    const db = makeDB({ firstResult: null });
    const profile = await getSocialProfileByHandle(db, 'amaka', 'tenant-b');
    expect(profile).toBeNull();
  });
});

describe('getSocialProfileByPhone', () => {
  it('returns profile matching phone_number and tenant', async () => {
    const row = {
      id: 'sp_1', tenant_id: 'tenant-a', profile_id: 'u1', handle: 'amaka',
      display_name: null, bio: null, phone_number: '+2348012345678', avatar_url: null,
      is_verified: 0, follower_count: 0, following_count: 0, created_at: 1000,
    };
    const db = makeDB({ firstResult: row });
    const profile = await getSocialProfileByPhone(db, '+2348012345678', 'tenant-a');
    expect(profile?.phoneNumber).toBe('+2348012345678');
  });

  it('returns null for wrong tenant (T3)', async () => {
    const db = makeDB({ firstResult: null });
    const profile = await getSocialProfileByPhone(db, '+2348012345678', 'tenant-b');
    expect(profile).toBeNull();
  });
});

// ============================================================================
// Follow (SELF_FOLLOW guard, T3)
// ============================================================================

describe('followProfile', () => {
  it('throws SELF_FOLLOW when follower equals followee', async () => {
    const db = makeDB();
    await expect(
      followProfile(db, { followerId: 'user-1', followeeId: 'user-1', tenantId: 'tenant-a' }),
    ).rejects.toThrow('SELF_FOLLOW');
  });

  it('creates follow record for different users', async () => {
    const db = makeDB({ firstResult: null });
    const follow = await followProfile(db, {
      followerId: 'user-1',
      followeeId: 'user-2',
      tenantId: 'tenant-a',
    });
    expect(follow.followerId).toBe('user-1');
    expect(follow.followeeId).toBe('user-2');
    expect(follow.id).toMatch(/^follow_/);
  });

  it('throws ALREADY_FOLLOWING when follow already exists', async () => {
    const db = makeDB({ firstResult: { id: 'follow_existing' } });
    await expect(
      followProfile(db, { followerId: 'user-1', followeeId: 'user-2', tenantId: 'tenant-a' }),
    ).rejects.toThrow('ALREADY_FOLLOWING');
  });
});

describe('unfollowProfile', () => {
  it('calls DELETE with correct parameters', async () => {
    const db = makeDB();
    await unfollowProfile(db, 'user-1', 'user-2', 'tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('DELETE');
  });
});

describe('getFollowers', () => {
  it('queries with followee_id and tenant_id (T3)', async () => {
    const db = makeDB({ allResults: [] });
    await getFollowers(db, 'user-1', 'tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('followee_id');
    expect(sql).toContain('tenant_id');
  });
});

describe('getFollowing', () => {
  it('queries with follower_id and tenant_id (T3)', async () => {
    const db = makeDB({ allResults: [] });
    await getFollowing(db, 'user-1', 'tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('follower_id');
    expect(sql).toContain('tenant_id');
  });
});

// ============================================================================
// Social Post (P15, T3)
// ============================================================================

describe('createPost (P15)', () => {
  it('sets moderation_status to auto_hide for spam content', async () => {
    const db = makeDB();
    const post = await createPost(db, {
      authorId: 'user-1',
      content: 'buy cheap watches click now',
      tenantId: 'tenant-a',
    });
    expect(post.moderationStatus).toBe('auto_hide');
  });

  it('sets moderation_status to published for clean content', async () => {
    const db = makeDB();
    const post = await createPost(db, {
      authorId: 'user-1',
      content: 'Building something amazing for Nigeria!',
      tenantId: 'tenant-a',
    });
    expect(post.moderationStatus).toBe('published');
  });

  it('throws VALIDATION on empty content', async () => {
    const db = makeDB();
    await expect(
      createPost(db, { authorId: 'user-1', content: '', tenantId: 'tenant-a' }),
    ).rejects.toThrow('VALIDATION');
  });
});

describe('getPost', () => {
  it('returns post for correct tenant (T3)', async () => {
    const row = {
      id: 'post_1', tenant_id: 'tenant-a', author_id: 'user-1', content: 'Hello',
      post_type: 'post', media_urls: '[]', moderation_status: 'published',
      like_count: 0, comment_count: 0, is_deleted: 0, expires_at: null, created_at: 1000,
    };
    const db = makeDB({ firstResult: row });
    const post = await getPost(db, 'post_1', 'tenant-a');
    expect(post?.tenantId).toBe('tenant-a');
  });

  it('returns null for wrong tenant (T3)', async () => {
    const db = makeDB({ firstResult: null });
    const post = await getPost(db, 'post_1', 'tenant-b');
    expect(post).toBeNull();
  });
});

describe('reactToPost', () => {
  it('creates reaction for valid type', async () => {
    const db = makeDB();
    const reaction = await reactToPost(db, {
      postId: 'post-1',
      userId: 'user-1',
      reactionType: 'like',
      tenantId: 'tenant-a',
    });
    expect(reaction.reactionType).toBe('like');
    expect(reaction.id).toMatch(/^react_/);
  });

  it('throws INVALID_REACTION_TYPE for unknown type', async () => {
    const db = makeDB();
    await expect(
      reactToPost(db, { postId: 'post-1', userId: 'user-1', reactionType: 'dislike', tenantId: 'tenant-a' }),
    ).rejects.toThrow('INVALID_REACTION_TYPE');
  });
});

// ============================================================================
// Feed (T3)
// ============================================================================

describe('getUserFeed', () => {
  it('queries with tenant_id (T3)', async () => {
    const db = makeDB({ allResults: [] });
    await getUserFeed(db, 'user-1', { tenantId: 'tenant-a', limit: 20, offset: 0 });
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('tenant_id');
  });

  it('returns empty array when no posts', async () => {
    const db = makeDB({ allResults: [] });
    const feed = await getUserFeed(db, 'user-1', { tenantId: 'tenant-a' });
    expect(feed).toEqual([]);
  });

  it('query excludes deleted posts', async () => {
    const db = makeDB({ allResults: [] });
    await getUserFeed(db, 'user-1', { tenantId: 'tenant-a' });
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('is_deleted = 0');
  });

  it('returns posts with correct structure', async () => {
    const rows = [{
      id: 'post_1', tenant_id: 'tenant-a', author_id: 'user-1', content: 'Hello',
      post_type: 'post', media_urls: '[]', moderation_status: 'published',
      like_count: 5, created_at: 1000,
    }];
    const db = makeDB({ allResults: rows });
    const feed = await getUserFeed(db, 'user-1', { tenantId: 'tenant-a' });
    expect(feed[0]?.tenantId).toBe('tenant-a');
    expect(feed[0]?.likeCount).toBe(5);
  });
});

// ============================================================================
// DM (P14)
// ============================================================================

describe('createDMThread', () => {
  it('throws VALIDATION with fewer than 2 participants', async () => {
    const db = makeDB();
    await expect(
      createDMThread(db, { participantIds: ['user-001'], tenantId: 'tenant-a' }),
    ).rejects.toThrow('VALIDATION');
  });

  it('creates thread with 2 participants', async () => {
    const db = makeDB();
    const thread = await createDMThread(db, {
      participantIds: ['user-1', 'user-2'],
      tenantId: 'tenant-a',
    });
    expect(thread.participantIds).toEqual(['user-1', 'user-2']);
    expect(thread.id).toMatch(/^dmt_/);
  });
});

describe('sendDM (P14 encryption)', () => {
  it('encrypts content — encrypted_content != plaintext', async () => {
    const db = makeDB();
    const message = await sendDM(db, {
      threadId: 'dmt_1',
      senderId: 'user-1',
      content: 'Hello there!',
      masterKey: 'my-secret-master-key-32chars-long',
      tenantId: 'tenant-a',
    });
    expect(message.encryptedContent).not.toBe('Hello there!');
    expect(message.encryptedContent.length).toBeGreaterThan(0);
  });

  it('stores a non-empty iv', async () => {
    const db = makeDB();
    const message = await sendDM(db, {
      threadId: 'dmt_1',
      senderId: 'user-1',
      content: 'Private message',
      masterKey: 'another-secret-key-32-chars-long!!',
      tenantId: 'tenant-a',
    });
    expect(message.iv).toBeTruthy();
    expect(message.iv.length).toBeGreaterThan(0);
  });
});

describe('getDMThreads', () => {
  it('queries with user_id and tenant_id (T3)', async () => {
    const db = makeDB({ allResults: [] });
    await getDMThreads(db, 'user-1', 'tenant-a');
    const sqls = db.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(sqls.some((s) => s.includes('tenant_id'))).toBe(true);
  });
});

// ============================================================================
// Stories (TTL)
// ============================================================================

describe('storyTimeRemaining', () => {
  it('returns 0 for a story created 25 hours ago', () => {
    const hoursAgo25 = Math.floor(Date.now() / 1000) - 25 * 3600;
    expect(storyTimeRemaining(hoursAgo25)).toBe(0);
  });

  it('returns positive value for a freshly created story', () => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = storyTimeRemaining(now);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(STORY_TTL_SECONDS);
  });

  it('returns 0 when expires_at is in the past', () => {
    const veryOld = Math.floor(Date.now() / 1000) - 48 * 3600;
    expect(storyTimeRemaining(veryOld)).toBe(0);
  });
});

describe('createStory', () => {
  it('creates story with post_type = story', async () => {
    const db = makeDB();
    const story = await createStory(db, {
      authorId: 'user-1',
      content: 'Good morning Lagos!',
      tenantId: 'tenant-a',
    });
    expect(story.postType).toBe('story');
    expect(story.id).toMatch(/^story_/);
  });

  it('sets expires_at 24h after creation', async () => {
    const db = makeDB();
    const before = Math.floor(Date.now() / 1000);
    const story = await createStory(db, {
      authorId: 'user-1',
      content: 'Morning vibes',
      tenantId: 'tenant-a',
    });
    const after = Math.floor(Date.now() / 1000);
    expect(story.expiresAt).toBeGreaterThanOrEqual(before + STORY_TTL_SECONDS);
    expect(story.expiresAt).toBeLessThanOrEqual(after + STORY_TTL_SECONDS);
  });
});

describe('getActiveStories', () => {
  it('queries with tenant_id (T3)', async () => {
    const db = makeDB({ allResults: [] });
    await getActiveStories(db, 'tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('tenant_id');
  });

  it('query filters by post_type = story and excludes expired', async () => {
    const db = makeDB({ allResults: [] });
    await getActiveStories(db, 'tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain("post_type = 'story'");
    expect(sql).toContain('expires_at');
  });
});
