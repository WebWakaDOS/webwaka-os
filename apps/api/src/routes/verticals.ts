/**
 * Verticals API routes — M8a
 *
 * GET  /verticals                        — list all active verticals (optional ?category=&priority=)
 * GET  /verticals/originals              — list 17 P1-Original verticals
 * GET  /verticals/:slug                  — get vertical detail by slug
 * GET  /verticals/:slug/entitlements     — get activation requirements for a vertical
 *
 * All routes are public (no auth required — verticals registry is global catalogue).
 * Tenant-scoped activation lives under /workspaces/:id/verticals (workspace-verticals.ts).
 *
 * Platform Invariants:
 *   T6 — geography-driven discovery (category filters)
 *   P2 — build once, reuse everywhere (static VERTICAL_ENTITLEMENTS)
 *
 * Milestone: M8a — Verticals Infrastructure
 */

import { Hono } from 'hono';
import {
  getVerticalBySlug,
  listVerticalsByCategory,
  listOriginalVerticals,
  extractEntitlements,
} from '@webwaka/verticals';
import type { Env } from '../env.js';

// ---------------------------------------------------------------------------
// D1Like (minimal interface — avoids direct CF Workers type import)
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const verticalsRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /verticals — list all active (non-deprecated) verticals.
 * Optional query params:
 *   ?category=transport         — filter by category
 *   ?priority=1                 — filter by priority tier (1=P1-Original)
 */
verticalsRoutes.get('/', async (c) => {
  const db = c.env.DB as unknown as D1Like;
  const category = c.req.query('category');
  const priority = c.req.query('priority');

  let results;
  if (category) {
    results = await listVerticalsByCategory(db, category);
    if (priority !== undefined) {
      const p = parseInt(priority, 10);
      results = results.filter((v) => v.priority === p);
    }
  } else if (priority !== undefined) {
    const p = parseInt(priority, 10);
    const { results: all } = await db
      .prepare(
        `SELECT * FROM verticals WHERE priority = ? AND status != 'deprecated' ORDER BY category ASC, display_name ASC`,
      )
      .bind(p)
      .all<{
        slug: string;
        display_name: string;
        category: string;
        priority: number;
        status: string;
      }>();
    results = all;
  } else {
    const { results: all } = await db
      .prepare(
        `SELECT * FROM verticals WHERE status != 'deprecated' ORDER BY priority ASC, category ASC, display_name ASC`,
      )
      .all<{
        slug: string;
        display_name: string;
        category: string;
        priority: number;
        status: string;
      }>();
    results = all;
  }

  return c.json({ verticals: results, count: results.length });
});

/**
 * GET /verticals/originals — the 17 P1-Original verticals (priority=1).
 * Must be declared before /:slug to avoid slug collision.
 */
verticalsRoutes.get('/originals', async (c) => {
  const db = c.env.DB as unknown as D1Like;
  const verticals = await listOriginalVerticals(db);
  return c.json({ verticals, count: verticals.length });
});

/**
 * GET /verticals/:slug — full detail for a specific vertical.
 */
verticalsRoutes.get('/:slug', async (c) => {
  const db = c.env.DB as unknown as D1Like;
  const slug = c.req.param('slug');

  const result = await getVerticalBySlug(db, slug);
  if (!result.found) {
    return c.json({ error: `Vertical '${slug}' not found` }, 404);
  }

  return c.json({ vertical: result.vertical });
});

/**
 * GET /verticals/:slug/entitlements — KYC tier and verification requirements.
 */
verticalsRoutes.get('/:slug/entitlements', async (c) => {
  const db = c.env.DB as unknown as D1Like;
  const slug = c.req.param('slug');

  const result = await getVerticalBySlug(db, slug);
  if (!result.found) {
    return c.json({ error: `Vertical '${slug}' not found` }, 404);
  }

  const entitlements = extractEntitlements(result.vertical!);
  return c.json({ entitlements });
});
