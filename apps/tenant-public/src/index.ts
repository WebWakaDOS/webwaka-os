/**
 * apps/tenant-public — Cloudflare Workers entry point for public tenant sites.
 *
 * Each tenant (identified by Host header → tenantSlug) gets a white-label
 * discovery page rendered server-side via the @webwaka/frontend package.
 *
 * Routes:
 *   GET /            — discovery page (public profiles)
 *   GET /profiles/:id — single profile view
 *   GET /health      — liveness probe
 *
 * Milestone 6 — Frontend Composition Layer
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { getTenantManifestBySlug, renderProfileList } from '@webwaka/frontend';
import type { TenantManifest } from '@webwaka/frontend';

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

const app = new Hono<{ Bindings: Env }>();

app.use('*', secureHeaders());
app.use('*', cors());

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ status: 'ok', app: 'tenant-public' }));

// ---------------------------------------------------------------------------
// Resolve tenant from Host header or x-tenant-slug
// ---------------------------------------------------------------------------

async function resolveTenant(c: { req: Request; env: Env }): Promise<TenantManifest | null> {
  const db = c.env.DB as unknown as D1Like;

  // x-tenant-slug header takes precedence (useful for testing)
  const headerSlug = (c.req as unknown as { header(name: string): string | undefined }).header('x-tenant-slug');
  if (headerSlug) return getTenantManifestBySlug(db, headerSlug);

  // Derive from Host: first subdomain segment (e.g. acme.webwaka.app → acme)
  const host = (c.req as unknown as { header(name: string): string | undefined }).header('host') ?? '';
  const slug = host.split('.')[0] ?? '';
  if (!slug) return null;

  return getTenantManifestBySlug(db, slug);
}

// ---------------------------------------------------------------------------
// Discovery page — GET /
// ---------------------------------------------------------------------------

app.get('/', async (c) => {
  const manifest = await resolveTenant({ req: c.req.raw, env: c.env });
  if (!manifest) return c.json({ error: 'Tenant not found' }, 404);
  if (!manifest.features.discoveryEnabled) return c.json({ error: 'Discovery disabled' }, 403);

  const db = c.env.DB as unknown as D1Like;
  const q = c.req.query('q');
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const perPage = Math.min(50, Math.max(1, parseInt(c.req.query('perPage') ?? '20', 10)));
  const offset = (page - 1) * perPage;

  let sql = `SELECT p.id, p.entity_id, p.entity_type, p.display_name, p.headline,
                    p.avatar_url, p.place_id, p.visibility, p.claim_status, p.content,
                    datetime(p.created_at,'unixepoch') AS created_at
             FROM profiles p
             WHERE p.workspace_id = ? AND p.visibility IN ('public','semi')`;
  const binds: unknown[] = [manifest.tenantId];

  if (q) {
    sql += ' AND p.display_name LIKE ?';
    binds.push(`%${q}%`);
  }

  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  binds.push(perPage, offset);

  const rows = await db.prepare(sql).bind(...binds).all<ProfileRow>();
  const profiles = renderProfileList(rows.results, manifest);

  return c.json({ manifest, profiles, page, perPage });
});

// ---------------------------------------------------------------------------
// Single profile — GET /profiles/:id
// ---------------------------------------------------------------------------

app.get('/profiles/:id', async (c) => {
  const manifest = await resolveTenant({ req: c.req.raw, env: c.env });
  if (!manifest) return c.json({ error: 'Tenant not found' }, 404);

  const profileId = c.req.param('id');
  const db = c.env.DB as unknown as D1Like;

  const row = await db
    .prepare(
      `SELECT p.id, p.entity_id, p.entity_type, p.display_name, p.headline,
              p.avatar_url, p.place_id, p.visibility, p.claim_status, p.content,
              datetime(p.created_at,'unixepoch') AS created_at
       FROM profiles p
       WHERE p.id = ? AND p.workspace_id = ? AND p.visibility != 'private'`,
    )
    .bind(profileId, manifest.tenantId)
    .first<ProfileRow>();

  if (!row) return c.json({ error: 'Profile not found' }, 404);

  const [profile] = renderProfileList([row], manifest);
  return c.json({ manifest, profile });
});

export default app;
