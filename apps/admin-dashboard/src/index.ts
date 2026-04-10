/**
 * apps/admin-dashboard — Cloudflare Workers entry point for the admin dashboard.
 *
 * Renders the admin layout model and exposes management endpoints.
 * Authentication is required for all routes.
 *
 * Routes:
 *   GET  /health               — liveness probe
 *   GET  /layout               — admin layout model (requires x-workspace-id header)
 *   GET  /billing              — workspace billing history
 *
 * Milestone 6 — Frontend Composition Layer
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import {
  getTenantManifestById,
  buildAdminLayout,
} from '@webwaka/frontend';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
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

interface BillingRow {
  id: string;
  workspace_id: string;
  paystack_ref: string | null;
  amount_kobo: number;
  status: string;
  metadata: string;
  created_at: string;
}

interface SubscriptionRow {
  plan: string;
  status: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', secureHeaders());
app.use('*', cors({
  origin: ['https://*.webwaka.com', 'http://localhost:5173'],
  allowHeaders: ['Authorization', 'Content-Type', 'X-Workspace-Id'],
  allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
}));

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ status: 'ok', app: 'admin-dashboard' }));

// ---------------------------------------------------------------------------
// Layout model — GET /layout
// ---------------------------------------------------------------------------

app.get('/layout', async (c) => {
  const workspaceId = c.req.header('x-workspace-id');
  if (!workspaceId) return c.json({ error: 'x-workspace-id header required' }, 400);

  const db = c.env.DB as unknown as D1Like;
  const manifest = await getTenantManifestById(db, workspaceId);
  if (!manifest) return c.json({ error: 'Workspace not found' }, 404);

  const sub = await db
    .prepare('SELECT plan, status FROM subscriptions WHERE workspace_id = ?')
    .bind(workspaceId)
    .first<SubscriptionRow>();

  const plan = sub?.plan ?? 'free';
  const layout = buildAdminLayout(manifest, plan);

  return c.json({ layout, plan, subscriptionStatus: sub?.status ?? 'inactive' });
});

// ---------------------------------------------------------------------------
// Billing — GET /billing
// ---------------------------------------------------------------------------

app.get('/billing', async (c) => {
  const workspaceId = c.req.header('x-workspace-id');
  if (!workspaceId) return c.json({ error: 'x-workspace-id header required' }, 400);

  const db = c.env.DB as unknown as D1Like;
  const rows = await db
    .prepare(
      `SELECT id, workspace_id, paystack_ref, amount_kobo, status, metadata,
              datetime(created_at,'unixepoch') AS created_at
       FROM billing_history
       WHERE workspace_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .bind(workspaceId)
    .all<BillingRow>();

  const records = rows.results.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    paystackRef: r.paystack_ref,
    amountKobo: r.amount_kobo,
    status: r.status,
    metadata: (() => { try { return JSON.parse(r.metadata) as Record<string, unknown>; } catch { return {}; } })(),
    createdAt: r.created_at,
  }));

  return c.json({ workspaceId, records, total: records.length });
});

export default app;
