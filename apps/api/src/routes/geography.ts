/**
 * Geography routes.
 * (Platform Invariant T6 — geography-driven discovery)
 *
 * GET /geography/:placeId       — fetch a single place node
 * GET /geography/:placeId/children — fetch immediate children
 *
 * Geography data is public — no auth required.
 * Results are cached in KV to avoid repeated D1 reads.
 */

import { Hono } from 'hono';
import { buildIndexFromD1 } from '@webwaka/geography';
import type { PlaceId } from '@webwaka/types';
import { asId } from '@webwaka/types';
import type { Env } from '../env.js';

const CACHE_TTL_SECONDS = 3600; // 1 hour
const CACHE_KEY = 'geography:index:v1';

const geographyRoutes = new Hono<{ Bindings: Env }>();

/**
 * Load the geography index from KV cache or rebuild from D1.
 * The index is rebuilt at most once per hour.
 */
async function getGeographyIndex(env: Env) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const cached = (await env.GEOGRAPHY_CACHE.get(CACHE_KEY, 'json')) as null | Record<string, unknown>;
  if (cached) {
    // Rebuild GeographyIndex Map from cached plain object
    return new Map(Object.entries(cached)) as unknown as Awaited<ReturnType<typeof buildIndexFromD1>>;
  }

  const index = await buildIndexFromD1(env.DB);

  // Serialize map to plain object for KV storage
  const serialized = Object.fromEntries(index);
  await env.GEOGRAPHY_CACHE.put(CACHE_KEY, JSON.stringify(serialized), {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  return index;
}

// GET /geography/:placeId
geographyRoutes.get('/:placeId', async (c) => {
  const placeId = asId<PlaceId>(c.req.param('placeId'));

  try {
    const index = await getGeographyIndex(c.env);
    const node = index.get(placeId);

    if (!node) {
      return c.json({ error: `Place '${placeId}' not found.` }, 404);
    }

    return c.json({ data: node });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return c.json({ error: message }, 500);
  }
});

// GET /geography/:placeId/children
geographyRoutes.get('/:placeId/children', async (c) => {
  const placeId = asId<PlaceId>(c.req.param('placeId'));

  try {
    const index = await getGeographyIndex(c.env);
    const children = Array.from(index.values()).filter(
      (node) => node.parentId === placeId,
    );

    return c.json({ data: children, count: children.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return c.json({ error: message }, 500);
  }
});

export { geographyRoutes };
