/**
 * @webwaka/community — unit tests
 * Milestone 7c — 45 tests
 *
 * Verifies:
 *   T3 — tenant_id isolation
 *   T4 — integer kobo only
 *   T5 — entitlement guards
 *   P10 — NDPR consent required
 *   P15 — classifyContent before post insert
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyContent } from './moderation.js';
import {
  FREE_COMMUNITY_ENTITLEMENTS,
  PRO_COMMUNITY_ENTITLEMENTS,
  ENTERPRISE_COMMUNITY_ENTITLEMENTS,
  assertPaidTiersEnabled,
  assertCoursesEnabled,
  assertMaxSpaces,
} from './entitlements.js';
import { createCommunitySpace, getCommunitySpace, listSpaces } from './space.js';
import { joinCommunity, getMembership, leaveCommunity, createMembershipTier } from './membership.js';
import { createChannel, listChannels, createChannelPost, listChannelPosts } from './channel.js';
import {
  createCourseModule,
  getCourseModules,
  createCourseLesson,
  getLessonById,
  recordLessonProgress,
} from './course.js';
import { createEvent, listEvents, rsvpToEvent } from './event.js';

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

function makeDB(overrides: {
  firstResult?: unknown;
  allResults?: unknown[];
} = {}): MockDB {
  const impl = (_sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: <T>() => Promise.resolve((overrides.firstResult ?? null) as T | null),
      run: () => Promise.resolve({ success: true }),
      all: <T>() => Promise.resolve({ results: (overrides.allResults ?? []) as T[] }),
    }),
    first: <T>() => Promise.resolve((overrides.firstResult ?? null) as T | null),
    all: <T>() => Promise.resolve({ results: (overrides.allResults ?? []) as T[] }),
  });
  return { prepare: vi.fn(impl) as unknown as MockPrepareFn };
}

function makeDBWithConsentAndNullSlug(): D1Like['prepare'] {
  const impl = (sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: <T>() => {
        if (sql.includes('consent_records')) return Promise.resolve({ id: 'consent_1' } as T);
        return Promise.resolve(null);
      },
      run: () => Promise.resolve({ success: true }),
      all: <T>() => Promise.resolve({ results: [] as T[] }),
    }),
  });
  return vi.fn(impl) as unknown as D1Like['prepare'];
}

// ============================================================================
// classifyContent (P15)
// ============================================================================

describe('classifyContent', () => {
  it('returns auto_hide for spam content', () => {
    const result = classifyContent('buy cheap watches follow me');
    expect(result.status).toBe('auto_hide');
    expect(result.reason).toBe('spam_detected');
  });

  it('returns published for clean content', () => {
    const result = classifyContent('Hello Lagos developers! Great to be here.');
    expect(result.status).toBe('published');
  });
});

// ============================================================================
// Entitlements (T5)
// ============================================================================

describe('assertPaidTiersEnabled', () => {
  it('throws ENTITLEMENT_DENIED on FREE plan', () => {
    expect(() => assertPaidTiersEnabled(FREE_COMMUNITY_ENTITLEMENTS)).toThrow(
      /ENTITLEMENT_DENIED/,
    );
  });

  it('does not throw on PRO plan', () => {
    expect(() => assertPaidTiersEnabled(PRO_COMMUNITY_ENTITLEMENTS)).not.toThrow();
  });

  it('does not throw on ENTERPRISE plan', () => {
    expect(() => assertPaidTiersEnabled(ENTERPRISE_COMMUNITY_ENTITLEMENTS)).not.toThrow();
  });
});

describe('assertCoursesEnabled', () => {
  it('throws ENTITLEMENT_DENIED on FREE plan', () => {
    expect(() => assertCoursesEnabled(FREE_COMMUNITY_ENTITLEMENTS)).toThrow(/ENTITLEMENT_DENIED/);
  });

  it('does not throw on ENTERPRISE plan', () => {
    expect(() => assertCoursesEnabled(ENTERPRISE_COMMUNITY_ENTITLEMENTS)).not.toThrow();
  });
});

describe('assertMaxSpaces', () => {
  it('throws when current count equals FREE limit (1)', () => {
    expect(() => assertMaxSpaces(1, FREE_COMMUNITY_ENTITLEMENTS)).toThrow(/ENTITLEMENT_DENIED/);
  });

  it('does not throw for unlimited spaces (-1) on ENTERPRISE', () => {
    expect(() => assertMaxSpaces(9999, ENTERPRISE_COMMUNITY_ENTITLEMENTS)).not.toThrow();
  });

  it('does not throw when under limit on PRO plan', () => {
    expect(() => assertMaxSpaces(4, PRO_COMMUNITY_ENTITLEMENTS)).not.toThrow();
  });
});

// ============================================================================
// Community Space (T3)
// ============================================================================

describe('createCommunitySpace', () => {
  it('creates a space and returns correct shape', async () => {
    const db = makeDB();
    const space = await createCommunitySpace(db.prepare.mock ? { prepare: db.prepare } : db, {
      name: 'Lagos Devs',
      slug: 'lagos-devs',
      tenantId: 'tenant-a',
    });
    expect(space.name).toBe('Lagos Devs');
    expect(space.slug).toBe('lagos-devs');
    expect(space.tenantId).toBe('tenant-a');
    expect(space.memberCount).toBe(0);
    expect(space.id).toMatch(/^cs_/);
  });

  it('throws SLUG_TAKEN when slug already exists in same tenant', async () => {
    const db = makeDB({ firstResult: { id: 'existing' } });
    await expect(
      createCommunitySpace({ prepare: db.prepare }, {
        name: 'Duplicate',
        slug: 'exists',
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow('SLUG_TAKEN');
  });
});

describe('getCommunitySpace', () => {
  it('returns space for correct tenant (T3)', async () => {
    const spaceRow = {
      id: 'cs_1',
      tenant_id: 'tenant-a',
      name: 'Lagos Devs',
      slug: 'lagos-devs',
      description: null,
      visibility: 'public',
      member_count: 0,
      created_at: 1000000,
    };
    const db = makeDB({ firstResult: spaceRow });
    const space = await getCommunitySpace({ prepare: db.prepare }, 'lagos-devs', 'tenant-a');
    expect(space).not.toBeNull();
    expect(space?.name).toBe('Lagos Devs');
  });

  it('returns null for wrong tenant (T3 isolation)', async () => {
    const db = makeDB({ firstResult: null });
    const space = await getCommunitySpace({ prepare: db.prepare }, 'lagos-devs', 'tenant-b');
    expect(space).toBeNull();
  });

  it('returns null for non-existent slug', async () => {
    const db = makeDB();
    const space = await getCommunitySpace({ prepare: db.prepare }, 'nonexistent', 'tenant-a');
    expect(space).toBeNull();
  });
});

describe('listSpaces', () => {
  it('returns spaces only for the given tenant (T3)', async () => {
    const rows = [
      { id: 'cs_1', tenant_id: 'tenant-a', name: 'A', slug: 'a', description: null, visibility: 'public', member_count: 0, created_at: 1000 },
    ];
    const db = makeDB({ allResults: rows });
    const spaces = await listSpaces({ prepare: db.prepare }, 'tenant-a');
    expect(spaces).toHaveLength(1);
    expect(spaces[0]?.tenantId).toBe('tenant-a');
  });

  it('returns empty array when no spaces for tenant', async () => {
    const db = makeDB();
    const spaces = await listSpaces({ prepare: db.prepare }, 'tenant-b');
    expect(spaces).toEqual([]);
  });
});

// ============================================================================
// Membership (P10, T4)
// ============================================================================

describe('joinCommunity (P10)', () => {
  it('throws NDPR_CONSENT_REQUIRED when no consent row exists', async () => {
    const db = makeDB({ firstResult: null });
    await expect(
      joinCommunity({ prepare: db.prepare }, {
        communityId: 'c-1',
        userId: 'user-1',
        tierId: 'tier-free',
        kycTier: 0,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow('NDPR_CONSENT_REQUIRED');
  });

  it('creates membership when consent exists', async () => {
    const db = { prepare: makeDBWithConsentAndNullSlug() };
    const membership = await joinCommunity(db, {
      communityId: 'c-1',
      userId: 'user-1',
      tierId: 'tier-free',
      kycTier: 0,
      tenantId: 'tenant-a',
    });
    expect(membership.status).toBe('active');
    expect(membership.communityId).toBe('c-1');
    expect(membership.userId).toBe('user-1');
    expect(membership.id).toMatch(/^mb_/);
  });
});

describe('getMembership', () => {
  it('returns membership for correct tenant (T3)', async () => {
    const row = {
      id: 'mb_1',
      tenant_id: 'tenant-a',
      community_id: 'c-1',
      user_id: 'user-1',
      tier_id: 'tier-free',
      status: 'active',
      kyc_tier: 0,
      joined_at: 1000,
      expires_at: null,
    };
    const db = makeDB({ firstResult: row });
    const m = await getMembership({ prepare: db.prepare }, 'user-1', 'c-1', 'tenant-a');
    expect(m).not.toBeNull();
    expect(m?.status).toBe('active');
  });

  it('returns null for wrong tenant (T3)', async () => {
    const db = makeDB({ firstResult: null });
    const m = await getMembership({ prepare: db.prepare }, 'user-1', 'c-1', 'tenant-b');
    expect(m).toBeNull();
  });

  it('returns null when membership does not exist', async () => {
    const db = makeDB();
    const m = await getMembership({ prepare: db.prepare }, 'user-2', 'c-1', 'tenant-a');
    expect(m).toBeNull();
  });
});

describe('leaveCommunity', () => {
  it('calls update with left status', async () => {
    const db = makeDB();
    await expect(
      leaveCommunity({ prepare: db.prepare }, 'user-1', 'c-1', 'tenant-a'),
    ).resolves.toBeUndefined();
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'left'"));
  });
});

describe('createMembershipTier (T4)', () => {
  it('throws T4_VIOLATION on float priceKobo', async () => {
    const db = makeDB();
    await expect(
      createMembershipTier({ prepare: db.prepare }, {
        communityId: 'c-1',
        name: 'Premium',
        priceKobo: 29.99,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow(/T4_VIOLATION/);
  });

  it('throws T4_VIOLATION on negative priceKobo', async () => {
    const db = makeDB();
    await expect(
      createMembershipTier({ prepare: db.prepare }, {
        communityId: 'c-1',
        name: 'Discount',
        priceKobo: -100,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow(/T4_VIOLATION/);
  });

  it('succeeds with integer priceKobo', async () => {
    const db = makeDB();
    const tier = await createMembershipTier({ prepare: db.prepare }, {
      communityId: 'c-1',
      name: 'Pro',
      priceKobo: 5000,
      tenantId: 'tenant-a',
    });
    expect(tier.priceKobo).toBe(5000);
    expect(Number.isInteger(tier.priceKobo)).toBe(true);
  });
});

// ============================================================================
// Channels (T3, P15)
// ============================================================================

describe('createChannel', () => {
  it('creates channel with correct fields', async () => {
    const db = makeDB();
    const channel = await createChannel({ prepare: db.prepare }, {
      communityId: 'c-1',
      name: 'General',
      tenantId: 'tenant-a',
    });
    expect(channel.name).toBe('General');
    expect(channel.communityId).toBe('c-1');
    expect(channel.tenantId).toBe('tenant-a');
    expect(channel.id).toMatch(/^ch_/);
  });
});

describe('listChannels', () => {
  it('returns channels scoped to tenant (T3)', async () => {
    const rows = [{ id: 'ch_1', tenant_id: 'tenant-a', community_id: 'c-1', name: 'General', type: 'discussion', created_at: 1000 }];
    const db = makeDB({ allResults: rows });
    const channels = await listChannels({ prepare: db.prepare }, 'c-1', 'tenant-a');
    expect(channels[0]?.tenantId).toBe('tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('tenant_id');
  });
});

describe('createChannelPost (P15)', () => {
  it('sets moderation_status to auto_hide for spam content', async () => {
    const db = makeDB();
    const post = await createChannelPost({ prepare: db.prepare }, {
      channelId: 'ch-1',
      authorId: 'user-1',
      content: 'buy cheap watches follow me',
      tenantId: 'tenant-a',
    });
    expect(post.moderationStatus).toBe('auto_hide');
  });

  it('sets moderation_status to published for clean content', async () => {
    const db = makeDB();
    const post = await createChannelPost({ prepare: db.prepare }, {
      channelId: 'ch-1',
      authorId: 'user-1',
      content: 'Welcome to the community! Excited to learn together.',
      tenantId: 'tenant-a',
    });
    expect(post.moderationStatus).toBe('published');
  });

  it('throws VALIDATION on empty content', async () => {
    const db = makeDB();
    await expect(
      createChannelPost({ prepare: db.prepare }, {
        channelId: 'ch-1',
        authorId: 'user-1',
        content: '',
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow('VALIDATION');
  });
});

describe('listChannelPosts', () => {
  it('returns posts scoped to tenant (T3)', async () => {
    const rows = [{
      id: 'cp_1', tenant_id: 'tenant-a', channel_id: 'ch-1',
      author_id: 'user-1', content: 'Hello', moderation_status: 'published',
      is_deleted: 0, created_at: 1000,
    }];
    const db = makeDB({ allResults: rows });
    const posts = await listChannelPosts({ prepare: db.prepare }, 'ch-1', 'tenant-a');
    expect(posts[0]?.tenantId).toBe('tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('tenant_id');
  });

  it('query excludes deleted posts (is_deleted = 0)', async () => {
    const db = makeDB({ allResults: [] });
    await listChannelPosts({ prepare: db.prepare }, 'ch-1', 'tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('is_deleted = 0');
  });
});

// ============================================================================
// Courses (T3, P6)
// ============================================================================

describe('createCourseModule', () => {
  it('creates module with correct fields', async () => {
    const db = makeDB();
    const mod = await createCourseModule({ prepare: db.prepare }, {
      communityId: 'c-1',
      title: 'Introduction',
      tenantId: 'tenant-a',
    });
    expect(mod.title).toBe('Introduction');
    expect(mod.tenantId).toBe('tenant-a');
    expect(mod.id).toMatch(/^mod_/);
  });
});

describe('getCourseModules', () => {
  it('queries with tenant_id (T3)', async () => {
    const db = makeDB({ allResults: [] });
    await getCourseModules({ prepare: db.prepare }, 'c-1', 'tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('tenant_id');
  });
});

describe('getLessonById', () => {
  it('returns lesson for correct tenant', async () => {
    const row = { id: 'ls_1', tenant_id: 'tenant-a', module_id: 'mod_1', title: 'Lesson 1', body: null, content_type: 'text', sort_order: 0, created_at: 1000 };
    const db = makeDB({ firstResult: row });
    const lesson = await getLessonById({ prepare: db.prepare }, 'ls_1', 'tenant-a');
    expect(lesson?.title).toBe('Lesson 1');
  });

  it('returns null for wrong tenant (T3)', async () => {
    const db = makeDB({ firstResult: null });
    const lesson = await getLessonById({ prepare: db.prepare }, 'ls_1', 'tenant-b');
    expect(lesson).toBeNull();
  });
});

describe('recordLessonProgress', () => {
  it('throws VALIDATION on progressPct > 100', async () => {
    const db = makeDB();
    await expect(
      recordLessonProgress({ prepare: db.prepare }, {
        lessonId: 'ls_1',
        userId: 'user-1',
        progressPct: 150,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow('VALIDATION');
  });

  it('throws VALIDATION on negative progressPct', async () => {
    const db = makeDB();
    await expect(
      recordLessonProgress({ prepare: db.prepare }, {
        lessonId: 'ls_1',
        userId: 'user-1',
        progressPct: -1,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow('VALIDATION');
  });
});

// ============================================================================
// Events (T3, T4)
// ============================================================================

describe('createEvent', () => {
  it('throws T4_VIOLATION on float ticketPriceKobo', async () => {
    const db = makeDB();
    await expect(
      createEvent({ prepare: db.prepare }, {
        communityId: 'c-1',
        title: 'Paid Workshop',
        type: 'live',
        startsAt: Date.now(),
        ticketPriceKobo: 29.99,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow(/non-negative integer/i);
  });

  it('throws T4_VIOLATION on negative ticketPriceKobo', async () => {
    const db = makeDB();
    await expect(
      createEvent({ prepare: db.prepare }, {
        communityId: 'c-1',
        title: 'Bad Event',
        type: 'live',
        startsAt: Date.now(),
        ticketPriceKobo: -100,
        tenantId: 'tenant-a',
      }),
    ).rejects.toThrow(/non-negative integer/i);
  });

  it('succeeds with integer ticketPriceKobo', async () => {
    const db = makeDB();
    const event = await createEvent({ prepare: db.prepare }, {
      communityId: 'c-1',
      title: 'Free Workshop',
      type: 'live',
      startsAt: Math.floor(Date.now() / 1000),
      ticketPriceKobo: 0,
      tenantId: 'tenant-a',
    });
    expect(event.ticketPriceKobo).toBe(0);
    expect(event.id).toMatch(/^ev_/);
  });
});

describe('listEvents', () => {
  it('queries with community_id and tenant_id (T3)', async () => {
    const db = makeDB({ allResults: [] });
    await listEvents({ prepare: db.prepare }, 'c-1', 'tenant-a');
    const sql = db.prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain('tenant_id');
    expect(sql).toContain('community_id');
  });
});

describe('rsvpToEvent', () => {
  it('throws EVENT_FULL when max_attendees reached', async () => {
    const row = { rsvp_count: 100, max_attendees: 100, ticket_price_kobo: 0 };
    const db = makeDB({ firstResult: row });
    await expect(
      rsvpToEvent({ prepare: db.prepare }, { eventId: 'ev-1', userId: 'user-1', tenantId: 'tenant-a' }),
    ).rejects.toThrow('EVENT_FULL');
  });

  it('throws PAYMENT_REQUIRED for paid event', async () => {
    const row = { rsvp_count: 0, max_attendees: -1, ticket_price_kobo: 5000 };
    const db = makeDB({ firstResult: row });
    await expect(
      rsvpToEvent({ prepare: db.prepare }, { eventId: 'ev-1', userId: 'user-1', tenantId: 'tenant-a' }),
    ).rejects.toThrow('PAYMENT_REQUIRED');
  });
});
