/**
 * Discovery routes — public, no auth required.
 *
 * GET  /discovery/search                         — full-text + geography-filtered search
 * GET  /discovery/profiles/:subjectType/:id      — hydrated public profile
 * POST /discovery/claim-intent                   — capture claim interest (no state change)
 * GET  /discovery/nearby/:placeId                — entities within a geography subtree
 * GET  /discovery/trending                       — most-viewed profiles this week
 *
 * Platform Invariants:
 *   T6 — geography-driven discovery
 *   Discovery endpoints are cross-tenant (no tenant_id filter — public data only)
 *   discovery_events are logged for all successful reads
 *
 * Milestone 4 — Discovery Layer MVP
 */

import { Hono } from 'hono';
import { EntityType, ClaimLifecycleState } from '@webwaka/types';
import { getProfileBySubject } from '@webwaka/entities';
import { getIndividualById, getOrganizationById, getPlaceById } from '@webwaka/entities';
import type { Env } from '../env.js';

const discoveryRoutes = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    run(): Promise<unknown>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hashIp(rawIp: string): Promise<string> {
  if (!rawIp || rawIp === 'unknown') return 'unknown';
  try {
    const encoded = new TextEncoder().encode(rawIp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    return 'unknown';
  }
}

async function logEvent(
  db: D1Like,
  eventType: string,
  opts: {
    entityType?: string;
    entityId?: string;
    placeId?: string;
    query?: string;
    actorId?: string;
    ipHash?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const id = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  try {
    await db
      .prepare(
        `INSERT INTO discovery_events (id, event_type, entity_type, entity_id, place_id, query, actor_id, ip_hash, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
      )
      .bind(
        id,
        eventType,
        opts.entityType ?? null,
        opts.entityId ?? null,
        opts.placeId ?? null,
        opts.query ?? null,
        opts.actorId ?? null,
        opts.ipHash ?? null,
        JSON.stringify(opts.metadata ?? {}),
      )
      .run();
  } catch (err) {
    console.error('[discovery] event log failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Route 1 — GET /discovery/search
// ---------------------------------------------------------------------------

discoveryRoutes.get('/search', async (c) => {
  const q = c.req.query('q');
  if (!q || q.trim().length < 2) {
    return c.json({ error: 'Query parameter "q" must be at least 2 characters.' }, 400);
  }

  const type = c.req.query('type');
  const placeId = c.req.query('placeId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const cursor = c.req.query('cursor');

  const db = c.env.DB as unknown as D1Like;

  interface SearchRow {
    entity_type: string;
    entity_id: string;
    display_name: string;
    place_id: string | null;
    ancestry_path: string;
    visibility: string;
  }

  // Use FTS5 MATCH for full-text search as specified (Platform Invariant — T3 discovery)
  // search_fts is a content-table virtual table over search_entries, so we JOIN back for metadata.
  let sql = `
    SELECT se.entity_type, se.entity_id, se.display_name, se.place_id, se.ancestry_path, se.visibility
    FROM search_fts
    JOIN search_entries se ON se.entity_id = search_fts.entity_id
    WHERE search_fts MATCH ?
      AND se.visibility = 'public'
  `;
  const binds: unknown[] = [q.replace(/[^a-zA-Z0-9À-ɏ\s]/g, ' ').trim() + '*'];

  if (type) {
    sql += ` AND se.entity_type = ?`;
    binds.push(type);
  }
  if (placeId) {
    sql += ` AND se.ancestry_path LIKE ?`;
    binds.push(`%${placeId}%`);
  }
  if (cursor) {
    sql += ` AND se.entity_id > ?`;
    binds.push(cursor);
  }
  sql += ` ORDER BY se.entity_id LIMIT ?`;
  binds.push(limit + 1);

  const rows = await db.prepare(sql).bind(...binds).all<SearchRow>();
  const items = rows.results.slice(0, limit);
  const nextCursor = rows.results.length > limit ? rows.results[limit]?.entity_id ?? null : null;

  await logEvent(db, 'search_hit', { query: q, metadata: { type, placeId } });

  return c.json({
    items: items.map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      displayName: r.display_name,
      placeId: r.place_id,
      placeName: null,
    })),
    nextCursor,
    total: items.length,
  });
});

// ---------------------------------------------------------------------------
// Route 2 — GET /discovery/profiles/:subjectType/:subjectId
// ---------------------------------------------------------------------------

discoveryRoutes.get('/profiles/:subjectType/:subjectId', async (c) => {
  const subjectType = c.req.param('subjectType');
  const subjectId = c.req.param('subjectId');

  const validTypes = [EntityType.Individual, EntityType.Organization, EntityType.Place];
  if (!validTypes.includes(subjectType as typeof EntityType.Individual)) {
    return c.json({ error: `Invalid subjectType: ${subjectType}` }, 400);
  }

  const db = c.env.DB as unknown as D1Like;

  const profile = await getProfileBySubject(db, subjectType as typeof EntityType.Individual, subjectId);
  if (!profile) {
    return c.json({ error: `Profile not found for ${subjectType}/${subjectId}` }, 404);
  }

  let subject: Record<string, unknown> | null = null;
  if (subjectType === EntityType.Individual) {
    const ind = await getIndividualById(db, 'any' as never, subjectId as never);
    if (ind) {
      const row = (ind as unknown) as Record<string, unknown>;
      const { tenantId: _t, tenant_id: _ti, ...rest } = row; // eslint-disable-line @typescript-eslint/no-unused-vars
      subject = rest;
    }
  } else if (subjectType === EntityType.Organization) {
    const org = await getOrganizationById(db, 'any' as never, subjectId as never);
    if (org) {
      const row = (org as unknown) as Record<string, unknown>;
      const { tenantId: _t, tenant_id: _ti, ...rest } = row; // eslint-disable-line @typescript-eslint/no-unused-vars
      subject = rest;
    }
  }

  let place: { id: string; name: string; ancestryPath: string[] } | null = null;
  if (profile.primaryPlaceId) {
    const placeRow = await getPlaceById(db, profile.primaryPlaceId as never);
    if (placeRow) {
      const p = (placeRow as unknown) as Record<string, unknown>;
      place = {
        id: profile.primaryPlaceId as string,
        name: (p['name'] as string) ?? '',
        ancestryPath: (() => {
          try { return JSON.parse((p['ancestryPath'] ?? p['ancestry_path'] ?? '[]') as string) as string[]; }
          catch { return []; }
        })(),
      };
    }
  }

  // Discovery is cross-tenant: query relationships by subjectId without tenant restriction.
  const { results: relationshipRows } = await db
    .prepare(
      `SELECT id, kind, subject_type, subject_id, object_type, object_id, metadata,
              datetime(created_at, 'unixepoch') AS created_at
       FROM relationships WHERE subject_id = ? ORDER BY created_at DESC LIMIT 20`,
    )
    .bind(subjectId)
    .all<Record<string, unknown>>();
  const relationships = relationshipRows;

  await logEvent(db, 'profile_view', { entityType: subjectType, entityId: subjectId });

  return c.json({
    profile: {
      id: profile.id,
      subjectType: profile.subjectType,
      subjectId: profile.subjectId,
      claimState: profile.claimState,
      primaryPlaceId: profile.primaryPlaceId ?? null,
    },
    subject,
    place,
    relationships,
  });
});

// ---------------------------------------------------------------------------
// Route 3 — POST /discovery/claim-intent
// ---------------------------------------------------------------------------

discoveryRoutes.post('/claim-intent', async (c) => {
  const body = await c.req.json<{
    subjectType: string;
    subjectId: string;
    contactEmail: string;
    contactName?: string;
    message?: string;
  }>();

  if (!body.subjectType || !body.subjectId || !body.contactEmail) {
    return c.json({ error: 'subjectType, subjectId and contactEmail are required.' }, 400);
  }

  if (!isValidEmail(body.contactEmail)) {
    return c.json({ error: 'Invalid contactEmail format.' }, 400);
  }

  if (body.message && body.message.length > 500) {
    return c.json({ error: 'message must be 500 characters or fewer.' }, 400);
  }

  const db = c.env.DB as unknown as D1Like;

  const profile = await getProfileBySubject(
    db,
    body.subjectType as typeof EntityType.Individual,
    body.subjectId,
  );

  if (!profile) {
    return c.json({ error: `Profile not found for ${body.subjectId}` }, 404);
  }

  const claimableStates = [
    ClaimLifecycleState.Seeded,
    ClaimLifecycleState.Claimable,
  ] as string[];

  if (!claimableStates.includes(profile.claimState as string)) {
    return c.json({
      error: `Profile is already in state '${profile.claimState}' and cannot accept a new claim intent.`,
    }, 409);
  }

  const rawIp = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
  const ipHash = await hashIp(rawIp);

  const recentIntents = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM discovery_events
       WHERE event_type = 'claim_intent' AND ip_hash = ? AND created_at > (unixepoch() - 86400)`,
    )
    .bind(ipHash)
    .first<{ cnt: number }>();

  if ((recentIntents?.cnt ?? 0) >= 3) {
    return c.json({ error: 'Rate limit exceeded: maximum 3 claim intents per 24 hours.' }, 429);
  }

  const intentId = `ci_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await logEvent(db, 'claim_intent', {
    entityType: body.subjectType,
    entityId: body.subjectId,
    ipHash,
    metadata: {
      intentId,
      contactEmail: body.contactEmail,
      contactName: body.contactName,
      message: body.message,
    },
  });

  return c.json({ success: true, intentId });
});

// ---------------------------------------------------------------------------
// Route 4 — GET /discovery/nearby/:placeId
// ---------------------------------------------------------------------------

discoveryRoutes.get('/nearby/:placeId', async (c) => {
  const placeId = c.req.param('placeId');
  const type = c.req.query('type');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const cursor = c.req.query('cursor');

  const db = c.env.DB as unknown as D1Like;

  const placeRow = await db
    .prepare(`SELECT id, name FROM places WHERE id = ? LIMIT 1`)
    .bind(placeId)
    .first<{ id: string; name: string }>();

  if (!placeRow) {
    return c.json({ error: `Place '${placeId}' not found.` }, 404);
  }

  interface NearbyRow {
    entity_type: string;
    entity_id: string;
    display_name: string;
    place_id: string;
  }

  let sql = `
    SELECT entity_type, entity_id, display_name, place_id
    FROM search_entries
    WHERE visibility = 'public'
      AND ancestry_path LIKE ?
  `;
  const binds: unknown[] = [`%${placeId}%`];

  if (type) {
    sql += ` AND entity_type = ?`;
    binds.push(type);
  }
  if (cursor) {
    sql += ` AND entity_id > ?`;
    binds.push(cursor);
  }
  sql += ` ORDER BY entity_id LIMIT ?`;
  binds.push(limit + 1);

  const rows = await db.prepare(sql).bind(...binds).all<NearbyRow>();
  const items = rows.results.slice(0, limit);
  const nextCursor = rows.results.length > limit ? rows.results[limit]?.entity_id ?? null : null;

  return c.json({
    items: items.map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      displayName: r.display_name,
      placeId: r.place_id,
      placeName: placeRow.name,
    })),
    nextCursor,
    placeId,
    placeName: placeRow.name,
  });
});

// ---------------------------------------------------------------------------
// Route 5 — GET /discovery/trending
// ---------------------------------------------------------------------------

discoveryRoutes.get('/trending', async (c) => {
  const type = c.req.query('type');
  const placeId = c.req.query('placeId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '10', 10), 50);

  const weekAgo = Math.floor(Date.now() / 1000) - 604800;
  const weekStarting = new Date(weekAgo * 1000).toISOString().slice(0, 10);

  const db = c.env.DB as unknown as D1Like;

  interface TrendingRow {
    entity_id: string;
    entity_type: string;
    view_count: number;
    display_name: string;
    place_id: string | null;
    ancestry_path: string;
  }

  let sql = `
    SELECT de.entity_id, de.entity_type, COUNT(*) as view_count,
           se.display_name, se.place_id, se.ancestry_path
    FROM discovery_events de
    JOIN search_entries se ON se.entity_id = de.entity_id
    WHERE de.event_type = 'profile_view'
      AND de.created_at > ?
      AND se.visibility = 'public'
  `;
  const binds: unknown[] = [weekAgo];

  if (type) {
    sql += ` AND de.entity_type = ?`;
    binds.push(type);
  }
  if (placeId) {
    sql += ` AND se.ancestry_path LIKE ?`;
    binds.push(`%${placeId}%`);
  }

  sql += `
    GROUP BY de.entity_id, de.entity_type, se.display_name, se.place_id, se.ancestry_path
    ORDER BY view_count DESC
    LIMIT ?
  `;
  binds.push(limit);

  const rows = await db.prepare(sql).bind(...binds).all<TrendingRow>();

  return c.json({
    items: rows.results.map((r) => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      displayName: r.display_name,
      viewCount: r.view_count,
      placeId: r.place_id,
    })),
    weekStarting,
  });
});

export { discoveryRoutes };
