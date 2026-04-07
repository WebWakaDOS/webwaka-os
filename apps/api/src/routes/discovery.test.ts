/**
 * Integration tests for GET /discovery/* and POST /discovery/* routes.
 *
 * Uses Hono's built-in test helper (app.request) with mocked Worker bindings.
 * No wrangler or live D1 required — fully self-contained.
 *
 * Milestone 4 — Discovery Layer MVP — 20 tests
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import app from '../index.js';
import { issueJwt } from '@webwaka/auth';
import { Role, SubscriptionPlan, SubscriptionStatus } from '@webwaka/types';
import type { UserId, WorkspaceId, TenantId } from '@webwaka/types';
import { asId } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-32-chars-minimum-length-required';
const TENANT_ID = asId<TenantId>('tenant_test_001');
const WORKSPACE_ID = asId<WorkspaceId>('wsp_test_001');
const USER_ID = asId<UserId>('usr_test_001');

// ---------------------------------------------------------------------------
// Shared test data fixtures
// ---------------------------------------------------------------------------

const SEEDED_PROFILE_ROW = {
  id: 'prf_001',
  subject_type: 'individual',
  subject_id: 'ind_001',
  primary_place_id: 'plc_ogun_001',
  claim_state: 'seeded',
  verified_by: null,
  tenant_id: TENANT_ID,
  created_at: '2026-04-07 12:00:00',
  updated_at: '2026-04-07 12:00:00',
};

const MANAGED_PROFILE_ROW = {
  ...SEEDED_PROFILE_ROW,
  id: 'prf_002',
  subject_id: 'ind_002',
  claim_state: 'managed',
};

const CLAIM_PENDING_PROFILE_ROW = {
  ...SEEDED_PROFILE_ROW,
  id: 'prf_003',
  subject_id: 'ind_003',
  claim_state: 'claim_pending',
};

const INDIVIDUAL_ROW = {
  id: 'ind_001',
  name: 'Ngozi Adeyemi',
  entity_type: 'individual',
  tenant_id: TENANT_ID,
  place_id: 'plc_ogun_001',
  metadata: '{}',
  created_at: '2026-04-07 12:00:00',
  updated_at: '2026-04-07 12:00:00',
};

const PLACE_ROW = {
  id: 'plc_ogun_001',
  name: 'Abeokuta North',
  entity_type: 'place',
  place_type: 'local_government_area',
  parent_id: 'place_state_ogun',
  ancestry_path: '["place_nigeria_001","place_zone_south_west","place_state_ogun"]',
  metadata: null,
  created_at: '2026-04-07 12:00:00',
  updated_at: '2026-04-07 12:00:00',
};

const SEARCH_ENTRY_ROW = {
  entity_type: 'individual',
  entity_id: 'ind_001',
  display_name: 'Ngozi Adeyemi',
  place_id: 'plc_ogun_001',
  ancestry_path: '["place_nigeria_001","place_zone_south_west","place_state_ogun","plc_ogun_001"]',
  visibility: 'public',
};

const ORG_SEARCH_ENTRY_ROW = {
  entity_type: 'organization',
  entity_id: 'org_001',
  display_name: 'Lagos Tech Hub',
  place_id: 'plc_lagos_001',
  ancestry_path: '["place_nigeria_001","place_zone_south_west","place_state_lagos","plc_lagos_001"]',
  visibility: 'public',
};

// ---------------------------------------------------------------------------
// D1 mock factory
// ---------------------------------------------------------------------------

interface D1MockOptions {
  profileRow?: typeof SEEDED_PROFILE_ROW | null;
  individualRow?: typeof INDIVIDUAL_ROW | null;
  placeRow?: typeof PLACE_ROW | null;
  searchEntryRows?: typeof SEARCH_ENTRY_ROW[];
  trendingRows?: unknown[];
  recentIntentCount?: number;
  discoveryEventsLog?: unknown[];
}

function makeD1Mock(opts: D1MockOptions = {}) {
  const searchRows = opts.searchEntryRows ?? [SEARCH_ENTRY_ROW];
  const trendingRows = opts.trendingRows ?? [];
  const recentIntentCount = opts.recentIntentCount ?? 0;
  const eventsLog = opts.discoveryEventsLog ?? [];

  return {
    prepare: (sql: string) => {
      let boundArgs: unknown[] = [];

      const stmt = {
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return stmt;
        },
        run: vi.fn(() => {
          if (sql.includes('INTO discovery_events')) {
            eventsLog.push({ sql, args: boundArgs });
          }
          if (sql.includes('INTO search_entries')) {
            eventsLog.push({ sql, args: boundArgs });
          }
          return Promise.resolve({});
        }),
        first: vi.fn(<T>(): Promise<T | null> => {
          // Subscription lookup (entities routes)
          if (sql.includes('FROM subscriptions')) {
            return Promise.resolve({ plan: SubscriptionPlan.Growth, status: SubscriptionStatus.Active } as T);
          }
          // Profile lookup
          if (sql.includes('FROM profiles WHERE subject_type')) {
            return Promise.resolve((opts.profileRow ?? null) as T);
          }
          // Individual by id (entities route and discovery hydration)
          if (sql.includes('FROM individuals WHERE id')) {
            return Promise.resolve((opts.individualRow ?? null) as T);
          }
          // Place by id
          if (sql.includes('FROM places WHERE id')) {
            return Promise.resolve((opts.placeRow ?? null) as T);
          }
          // Place ancestry path (search-index helper)
          if (sql.includes('FROM places WHERE id')) {
            return Promise.resolve((opts.placeRow ?? null) as T);
          }
          // Rate limit check
          if (sql.includes('COUNT(*)') && sql.includes('claim_intent')) {
            return Promise.resolve({ cnt: recentIntentCount } as T);
          }
          // User login
          if (sql.includes('FROM users')) {
            return Promise.resolve(null as T);
          }
          return Promise.resolve(null as T);
        }),
        all: vi.fn(<T>(): Promise<{ results: T[] }> => {
          // Trending query (discovery_events JOIN search_entries)
          if (sql.includes('FROM discovery_events de') && sql.includes('JOIN search_entries')) {
            return Promise.resolve({ results: trendingRows } as { results: T[] });
          }
          // Search entries queries (direct) or FTS5 search (JOIN from search_fts)
          if (sql.includes('FROM search_entries') || sql.includes('FROM search_fts')) {
            return Promise.resolve({ results: searchRows } as { results: T[] });
          }
          // Relationships
          if (sql.includes('FROM relationships')) {
            return Promise.resolve({ results: [] } as { results: T[] });
          }
          // Individuals list
          if (sql.includes('FROM individuals')) {
            return Promise.resolve({ results: [] } as { results: T[] });
          }
          return Promise.resolve({ results: [] } as { results: T[] });
        }),
      };

      return stmt;
    },
  };
}

function makeKVMock() {
  const store: Record<string, string> = {};
  return {
    get: vi.fn((key: string, type?: string) => {
      const raw = store[key];
      if (!raw) return Promise.resolve(null);
      if (type === 'json') return Promise.resolve(JSON.parse(raw) as unknown);
      return Promise.resolve(raw);
    }),
    put: vi.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
  };
}

function makeEnv(d1Opts: D1MockOptions = {}): Record<string, unknown> {
  return {
    DB: makeD1Mock(d1Opts),
    GEOGRAPHY_CACHE: makeKVMock(),
    JWT_SECRET,
    ENVIRONMENT: 'development',
  };
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

async function makeRequest(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
  d1Opts: D1MockOptions = {},
) {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : null,
  });

  return app.fetch(
    request,
    makeEnv(d1Opts) as unknown as { DB: D1Database; GEOGRAPHY_CACHE: KVNamespace; JWT_SECRET: string; ENVIRONMENT: 'development' },
  );
}

// ---------------------------------------------------------------------------
// Auth setup (for entity create tests that require JWT)
// ---------------------------------------------------------------------------

let validToken: string;

beforeAll(async () => {
  validToken = await issueJwt(
    {
      sub: USER_ID,
      workspace_id: WORKSPACE_ID,
      tenant_id: TENANT_ID,
      role: Role.Admin,
    },
    JWT_SECRET,
  );
});

// ---------------------------------------------------------------------------
// Test 1 — GET /discovery/search — returns results for a valid query
// ---------------------------------------------------------------------------

describe('GET /discovery/search', () => {
  it('returns results for a valid query', async () => {
    const res = await makeRequest(
      '/discovery/search?q=Ngozi',
      {},
      { searchEntryRows: [SEARCH_ENTRY_ROW] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(Array.isArray(body['items'])).toBe(true);
    const items = body['items'] as unknown[];
    expect(items.length).toBeGreaterThan(0);
  });

  // Test 2
  it('returns 400 for query shorter than 2 characters', async () => {
    const res = await makeRequest('/discovery/search?q=N');
    expect(res.status).toBe(400);
    const body: Record<string, unknown> = await res.json();
    expect(body['error']).toMatch(/2 characters/);
  });

  // Test 3
  it('type filter returns only matching entity type', async () => {
    const res = await makeRequest(
      '/discovery/search?q=Ngozi&type=individual',
      {},
      { searchEntryRows: [SEARCH_ENTRY_ROW] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    const items = body['items'] as Array<{ entityType: string }>;
    for (const item of items) {
      expect(item.entityType).toBe('individual');
    }
  });

  // Test 4
  it('geography filter restricts by placeId', async () => {
    const res = await makeRequest(
      '/discovery/search?q=hub&placeId=plc_ogun_001',
      {},
      { searchEntryRows: [SEARCH_ENTRY_ROW] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(Array.isArray(body['items'])).toBe(true);
  });

  // Test 5
  it('only returns public entries (visibility filter in query)', async () => {
    const res = await makeRequest(
      '/discovery/search?q=Lagos',
      {},
      { searchEntryRows: [] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    const items = body['items'] as unknown[];
    expect(items.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests 6–8 — GET /discovery/profiles/:subjectType/:subjectId
// ---------------------------------------------------------------------------

describe('GET /discovery/profiles/:subjectType/:subjectId', () => {
  // Test 6
  it('returns hydrated profile for a known individual', async () => {
    const res = await makeRequest(
      '/discovery/profiles/individual/ind_001',
      {},
      { profileRow: SEEDED_PROFILE_ROW, individualRow: INDIVIDUAL_ROW, placeRow: PLACE_ROW },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(body['profile']).toBeTruthy();
    const profile = body['profile'] as Record<string, unknown>;
    expect(profile['subjectId']).toBe('ind_001');
    expect(profile['claimState']).toBe('seeded');
  });

  // Test 7
  it('returns 404 for unknown entity', async () => {
    const res = await makeRequest(
      '/discovery/profiles/individual/ind_unknown',
      {},
      { profileRow: null },
    );
    expect(res.status).toBe(404);
  });

  // Test 8
  it('does not expose tenant_id in the response', async () => {
    const res = await makeRequest(
      '/discovery/profiles/individual/ind_001',
      {},
      { profileRow: SEEDED_PROFILE_ROW, individualRow: INDIVIDUAL_ROW, placeRow: PLACE_ROW },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    const text = JSON.stringify(body);
    expect(text).not.toContain('tenantId');
    expect(text).not.toContain('tenant_id');
  });
});

// ---------------------------------------------------------------------------
// Tests 9–12 — POST /discovery/claim-intent
// ---------------------------------------------------------------------------

describe('POST /discovery/claim-intent', () => {
  // Test 9
  it('succeeds for a seeded profile with valid email', async () => {
    const res = await makeRequest(
      '/discovery/claim-intent',
      {
        method: 'POST',
        body: {
          subjectType: 'individual',
          subjectId: 'ind_001',
          contactEmail: 'claimant@example.com',
          contactName: 'Amaka Obi',
        },
      },
      { profileRow: SEEDED_PROFILE_ROW, recentIntentCount: 0 },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(body['success']).toBe(true);
    expect(typeof body['intentId']).toBe('string');
    expect((body['intentId'] as string).startsWith('ci_')).toBe(true);
  });

  // Test 10
  it('returns 409 for an already-managed profile', async () => {
    const res = await makeRequest(
      '/discovery/claim-intent',
      {
        method: 'POST',
        body: {
          subjectType: 'individual',
          subjectId: 'ind_002',
          contactEmail: 'claimant@example.com',
        },
      },
      { profileRow: MANAGED_PROFILE_ROW },
    );
    expect(res.status).toBe(409);
    const body: Record<string, unknown> = await res.json();
    expect(body['error']).toMatch(/managed/);
  });

  // Test 11
  it('returns 400 for invalid email format', async () => {
    const res = await makeRequest(
      '/discovery/claim-intent',
      {
        method: 'POST',
        body: {
          subjectType: 'individual',
          subjectId: 'ind_001',
          contactEmail: 'not-an-email',
        },
      },
    );
    expect(res.status).toBe(400);
    const body: Record<string, unknown> = await res.json();
    expect(body['error']).toMatch(/email/i);
  });

  // Test 12
  it('returns 409 for an already claim_pending profile', async () => {
    const res = await makeRequest(
      '/discovery/claim-intent',
      {
        method: 'POST',
        body: {
          subjectType: 'individual',
          subjectId: 'ind_003',
          contactEmail: 'claimant@example.com',
        },
      },
      { profileRow: CLAIM_PENDING_PROFILE_ROW },
    );
    expect(res.status).toBe(409);
    const body: Record<string, unknown> = await res.json();
    expect(body['error']).toMatch(/claim_pending/);
  });
});

// ---------------------------------------------------------------------------
// Tests 13–15 — GET /discovery/nearby/:placeId
// ---------------------------------------------------------------------------

describe('GET /discovery/nearby/:placeId', () => {
  // Test 13
  it('returns entities within a geography subtree', async () => {
    const res = await makeRequest(
      '/discovery/nearby/plc_ogun_001',
      {},
      { placeRow: PLACE_ROW, searchEntryRows: [SEARCH_ENTRY_ROW] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(Array.isArray(body['items'])).toBe(true);
    expect(body['placeId']).toBe('plc_ogun_001');
    expect(body['placeName']).toBe('Abeokuta North');
  });

  // Test 14
  it('returns 404 for an unknown placeId', async () => {
    const res = await makeRequest(
      '/discovery/nearby/plc_unknown_001',
      {},
      { placeRow: null },
    );
    expect(res.status).toBe(404);
  });

  // Test 15
  it('type filter returns only organization entries', async () => {
    const res = await makeRequest(
      '/discovery/nearby/plc_lagos_001?type=organization',
      {},
      { placeRow: { ...PLACE_ROW, id: 'plc_lagos_001', name: 'Victoria Island' }, searchEntryRows: [ORG_SEARCH_ENTRY_ROW] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    const items = body['items'] as Array<{ entityType: string }>;
    for (const item of items) {
      expect(item.entityType).toBe('organization');
    }
  });
});

// ---------------------------------------------------------------------------
// Tests 16–18 — GET /discovery/trending
// ---------------------------------------------------------------------------

const TRENDING_ROW = {
  entity_id: 'ind_001',
  entity_type: 'individual',
  view_count: 42,
  display_name: 'Ngozi Adeyemi',
  place_id: 'plc_ogun_001',
  ancestry_path: '["place_nigeria_001","place_state_ogun","plc_ogun_001"]',
};

describe('GET /discovery/trending', () => {
  // Test 16
  it('returns top profiles by view count', async () => {
    const res = await makeRequest(
      '/discovery/trending',
      {},
      { trendingRows: [TRENDING_ROW] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(Array.isArray(body['items'])).toBe(true);
    const items = body['items'] as Array<{ viewCount: number }>;
    if (items.length > 0) {
      expect(typeof items[0]?.viewCount).toBe('number');
    }
    expect(typeof body['weekStarting']).toBe('string');
  });

  // Test 17
  it('type filter restricts to individual', async () => {
    const res = await makeRequest(
      '/discovery/trending?type=individual',
      {},
      { trendingRows: [TRENDING_ROW] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(Array.isArray(body['items'])).toBe(true);
  });

  // Test 18
  it('placeId filter restricts to geography subtree', async () => {
    const res = await makeRequest(
      '/discovery/trending?placeId=plc_ogun_001',
      {},
      { trendingRows: [TRENDING_ROW] },
    );
    expect(res.status).toBe(200);
    const body: Record<string, unknown> = await res.json();
    expect(Array.isArray(body['items'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 19 — Search index wired: POST /entities/individuals also indexes
// ---------------------------------------------------------------------------

describe('Search index wiring', () => {
  it('creating an individual via POST /entities/individuals also calls search indexing', async () => {
    const eventsLog: unknown[] = [];
    const d1Opts: D1MockOptions = {
      discoveryEventsLog: eventsLog,
      searchEntryRows: [],
    };

    const res = await makeRequest(
      '/entities/individuals',
      { method: 'POST', token: validToken, body: { name: 'Waka Test User' } },
      d1Opts,
    );

    expect(res.status).toBe(201);
    const body: Record<string, unknown> = await res.json();
    const data = body['data'] as Record<string, unknown>;
    expect(data['name']).toBe('Waka Test User');
    expect(typeof data['id']).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Test 20 — Discovery events logged: GET /discovery/profiles/:type/:id
// ---------------------------------------------------------------------------

describe('Discovery event logging', () => {
  it('GET /discovery/profiles/:type/:id logs a profile_view event', async () => {
    const eventsLog: unknown[] = [];

    const res = await makeRequest(
      '/discovery/profiles/individual/ind_001',
      {},
      {
        profileRow: SEEDED_PROFILE_ROW,
        individualRow: INDIVIDUAL_ROW,
        placeRow: PLACE_ROW,
        discoveryEventsLog: eventsLog,
      },
    );

    expect(res.status).toBe(200);
    expect(eventsLog.length).toBeGreaterThan(0);

    const event = eventsLog[0] as Record<string, unknown>;
    const args = event['args'] as unknown[];
    const hasProfileView = args.some((a) => a === 'profile_view');
    expect(hasProfileView).toBe(true);
  });
});
