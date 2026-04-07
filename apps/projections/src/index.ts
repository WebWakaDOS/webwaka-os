/**
 * apps/projections — Cloudflare Workers event processor.
 *
 * Consumes from Cloudflare Queue (M7+) or is triggered via a Scheduled Worker
 * (cron) to rebuild search index projections from the event_log.
 *
 * In M6: exposes an HTTP API for manual rebuild + analytics snapshot.
 *
 * Routes:
 *   GET  /health                      — liveness probe
 *   POST /rebuild/search              — rebuild search index from events
 *   POST /rebuild/analytics           — rebuild analytics snapshot (stub)
 *   GET  /events/:aggregate/:id       — fetch events for an aggregate
 *
 * Milestone 6 — Event Bus Layer
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import {
  rebuildSearchIndexFromEvents,
  getAggregateEvents,
} from '@webwaka/events';

interface Env {
  DB: D1Database;
  ENVIRONMENT: 'development' | 'staging' | 'production';
}

interface D1Like {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    run(): Promise<{ success: boolean }>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', secureHeaders());
app.use('*', cors());

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ status: 'ok', app: 'projections' }));

// ---------------------------------------------------------------------------
// Rebuild search index — POST /rebuild/search
// ---------------------------------------------------------------------------

app.post('/rebuild/search', async (c) => {
  const db = c.env.DB as unknown as D1Like;

  const start = Date.now();
  const result = await rebuildSearchIndexFromEvents(db);
  const durationMs = Date.now() - start;

  if (result.errors.length > 0) {
    console.error('[projections] rebuild/search errors:', result.errors);
  }

  return c.json({ ...result, durationMs }, result.errors.length > 0 ? 207 : 200);
});

// ---------------------------------------------------------------------------
// Rebuild analytics snapshot — POST /rebuild/analytics (stub for M7)
// ---------------------------------------------------------------------------

app.post('/rebuild/analytics', async (c) => {
  // In M7 this will aggregate event_log into analytics_snapshots.
  // For M6 we acknowledge + return a stub response.
  return c.json({
    status: 'scheduled',
    message: 'Analytics rebuild queued (stub — full implementation in M7)',
  });
});

// ---------------------------------------------------------------------------
// Aggregate event history — GET /events/:aggregate/:id
// ---------------------------------------------------------------------------

app.get('/events/:aggregate/:id', async (c) => {
  const aggregate = c.req.param('aggregate');
  const aggregateId = c.req.param('id');
  const db = c.env.DB as unknown as D1Like;

  const events = await getAggregateEvents(db, aggregate, aggregateId);

  return c.json({ aggregate, aggregateId, events, total: events.length });
});

export default app;
