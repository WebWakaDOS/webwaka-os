/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/**
 * Geography route tests (M7e)
 * Tests: /geography/states, /geography/lgas, /geography/wards (new M7e routes)
 * Minimum: 5 tests
 */

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { geographyRoutes } from './geography.js';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function makeApp(dbRows?: { states?: object[]; lgas?: object[]; wards?: object[] }): Hono {
  const app = new Hono();

  const stateRows = dbRows?.states ?? [
    { id: 'place_lagos_001', name: 'Lagos', geography_type: 'state', parent_id: null },
    { id: 'place_abuja_001', name: 'Abuja', geography_type: 'state', parent_id: null },
  ];
  const lgaRows = dbRows?.lgas ?? [
    { id: 'place_ikeja_001', name: 'Ikeja', geography_type: 'local_government_area', parent_id: 'place_lagos_001' },
    { id: 'place_eti_001', name: 'Eti-Osa', geography_type: 'local_government_area', parent_id: 'place_lagos_001' },
  ];
  const wardRows = dbRows?.wards ?? [
    { id: 'place_ward_001', name: 'Ikeja Ward 1', geography_type: 'ward', parent_id: 'place_ikeja_001' },
  ];

  const mockDB = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        all: <T>() => {
          if (sql.includes("geography_type = 'state'")) return Promise.resolve({ results: stateRows as T[] });
          if (sql.includes("geography_type = 'local_government_area'")) return Promise.resolve({ results: lgaRows as T[] });
          if (sql.includes("geography_type = 'ward'")) return Promise.resolve({ results: wardRows as T[] });
          return Promise.resolve({ results: [] as T[] });
        },
      }),
      all: <T>() => {
        if (sql.includes("geography_type = 'state'")) return Promise.resolve({ results: stateRows as T[] });
        return Promise.resolve({ results: [] as T[] });
      },
    })),
  };

  const mockKVCache = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
  };

  app.use('*', async (c, next) => {
    c.env = { DB: mockDB, GEOGRAPHY_CACHE: mockKVCache } as never;
    await next();
  });

  app.route('/geography', geographyRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /geography/states', () => {
  it('returns 200 with array of states', async () => {
    const app = makeApp();
    const res = await app.request('/geography/states');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['data'])).toBe(true);
    expect((body['data'] as unknown[]).length).toBeGreaterThan(0);
    expect(body['count']).toBe(2);
  });
});

describe('GET /geography/lgas', () => {
  it('returns 200 with LGAs for a given stateId', async () => {
    const app = makeApp();
    const res = await app.request('/geography/lgas?stateId=place_lagos_001');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['data'])).toBe(true);
    expect((body['data'] as unknown[]).length).toBeGreaterThan(0);
  });

  it('returns 400 when stateId is missing', async () => {
    const app = makeApp();
    const res = await app.request('/geography/lgas');
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toMatch(/stateId/);
  });
});

describe('GET /geography/wards', () => {
  it('returns 200 with wards for a given lgaId', async () => {
    const app = makeApp();
    const res = await app.request('/geography/wards?lgaId=place_ikeja_001');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body['data'])).toBe(true);
  });

  it('returns 400 when lgaId is missing', async () => {
    const app = makeApp();
    const res = await app.request('/geography/wards');
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toMatch(/lgaId/);
  });
});
