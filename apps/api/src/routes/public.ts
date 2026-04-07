/**
 * Public-facing frontend composition routes.
 *
 *   GET  /public/:tenantSlug            — tenant manifest + discovery page
 *   GET  /admin/:workspaceId/dashboard  — admin layout model (auth required)
 *   POST /themes/:tenantId              — update tenant branding (admin only)
 *
 * Milestone 6 — Frontend Composition Layer
 */

import { Hono } from 'hono';
import type { Env } from '../env.js';
import type { AuthContext } from '@webwaka/types';
import {
  getTenantManifestBySlug,
  getTenantManifestById,
  validateBranding,
  buildAdminLayout,
} from '@webwaka/frontend';

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

interface ProfileRow {
  id: string;
  entity_id: string;
  entity_type: string;
  display_name: string;
  headline: string | null;
  avatar_url: string | null;
  place_id: string | null;
  visibility: string;
  claim_status: string | null;
  content: string | null;
  created_at: string;
}

interface SubscriptionRow {
  plan: string;
}

type AppEnv = { Bindings: Env; Variables: { auth?: AuthContext } };

// ---------------------------------------------------------------------------
// Public tenant page — GET /public/:tenantSlug
// ---------------------------------------------------------------------------

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get('/:tenantSlug', async (c) => {
  const tenantSlug = c.req.param('tenantSlug');
  const db = c.env.DB as unknown as D1Like;

  const manifest = await getTenantManifestBySlug(db, tenantSlug);
  if (!manifest) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  if (!manifest.features.discoveryEnabled) {
    return c.json({ error: 'Discovery is not enabled for this tenant' }, 403);
  }

  // Load public profiles for this tenant
  const q = c.req.query('q');
  const entityType = c.req.query('entityType');
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(c.req.query('perPage') ?? '20', 10)));
  const offset = (page - 1) * perPage;

  let sql = `SELECT p.id, p.entity_id, p.entity_type, p.display_name, p.headline,
                    p.avatar_url, p.place_id, p.visibility, p.claim_status, p.content,
                    datetime(p.created_at,'unixepoch') AS created_at
             FROM profiles p
             WHERE p.workspace_id = ? AND p.visibility IN ('public','semi')`;
  const binds: unknown[] = [manifest.tenantId];

  if (entityType) {
    sql += ' AND p.entity_type = ?';
    binds.push(entityType);
  }

  if (q) {
    sql += ' AND p.display_name LIKE ?';
    binds.push(`%${q}%`);
  }

  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  binds.push(perPage, offset);

  const rows = await db.prepare(sql).bind(...binds).all<ProfileRow>();

  return c.json({
    manifest,
    profiles: rows.results,
    page,
    perPage,
    total: rows.results.length,
  });
});

// ---------------------------------------------------------------------------
// Admin dashboard model — GET /admin/:workspaceId/dashboard
// ---------------------------------------------------------------------------

export const adminPublicRoutes = new Hono<AppEnv>();

adminPublicRoutes.get('/:workspaceId/dashboard', async (c) => {
  const workspaceId = c.req.param('workspaceId');
  const db = c.env.DB as unknown as D1Like;

  const manifest = await getTenantManifestById(db, workspaceId);
  if (!manifest) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  const sub = await db
    .prepare(`SELECT plan FROM subscriptions WHERE workspace_id = ?`)
    .bind(workspaceId)
    .first<SubscriptionRow>();

  const plan = sub?.plan ?? 'free';
  const layout = buildAdminLayout(manifest, plan);

  return c.json({ layout, plan });
});

// ---------------------------------------------------------------------------
// Theme update — POST /themes/:tenantId
// ---------------------------------------------------------------------------

export const themeRoutes = new Hono<AppEnv>();

themeRoutes.post('/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = c.env.DB as unknown as D1Like;

  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const validation = validateBranding(body);
  if (!validation.valid) {
    return c.json({ error: 'Validation failed', details: validation.errors }, 422);
  }

  // Load current branding
  const row = await db
    .prepare(`SELECT branding FROM workspaces WHERE id = ?`)
    .bind(tenantId)
    .first<{ branding: string | null }>();

  if (!row) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  const current: Record<string, unknown> = row.branding ? JSON.parse(row.branding) as Record<string, unknown> : {};
  const merged = { ...current, ...validation.branding };

  await db
    .prepare(`UPDATE workspaces SET branding = ?, updated_at = unixepoch() WHERE id = ?`)
    .bind(JSON.stringify(merged), tenantId)
    .run();

  return c.json({ tenantId, branding: merged });
});
