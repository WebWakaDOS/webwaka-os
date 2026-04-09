/**
 * Workspace Verticals routes — M8a
 *
 * POST /workspaces/:id/verticals/:slug/activate
 *   — Activate a vertical for a workspace (FSM: seeded → claimed).
 *     Checks all entitlement requirements before advancing state.
 *
 * GET  /workspaces/:id/verticals
 *   — List verticals activated/in-progress for this workspace.
 *
 * All routes require auth (authMiddleware in index.ts).
 *
 * Platform Invariants:
 *   T3 — tenant_id scoping on all D1 queries
 *   T5 — entitlement checks gate vertical activation
 *   P2 — FSM engine from @webwaka/verticals
 *
 * Milestone: M8a — Verticals Infrastructure
 */

import { Hono } from 'hono';
import {
  getVerticalBySlug,
  extractEntitlements,
  checkActivationRequirements,
  VerticalActivationError,
} from '@webwaka/verticals';
import type { VerticalActivationContext } from '@webwaka/verticals';
import type { Env } from '../env.js';

// ---------------------------------------------------------------------------
// D1Like
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceVerticalRow {
  id: string;
  workspace_id: string;
  tenant_id: string;
  vertical_slug: string;
  state: string;
  activated_at: number | null;
  suspended_at: number | null;
  created_at: number;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const workspaceVerticalsRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /workspaces/:id/verticals/:slug/activate
 *
 * Begins vertical activation for a workspace.
 * Validates entitlements from KYC context then records state as 'claimed'.
 * Full FSM transition to 'active' requires additional vertical-specific checks
 * (e.g. CAC for motor-park, FRSC for rideshare) — those run in the vertical's
 * own package when it is built out in M8b/M8c.
 */
workspaceVerticalsRoutes.post('/:id/verticals/:slug/activate', async (c) => {
  const auth = c.get('auth') as {
    userId: string;
    tenantId: string;
  };
  const workspaceId = c.req.param('id');
  const slug = c.req.param('slug');
  const db = c.env.DB as unknown as D1Like;

  // 1. Verify the workspace belongs to this tenant (T3)
  const workspace = await db
    .prepare(
      `SELECT id, owner_id, kyc_tier, frsc_verified, cac_verified, it_verified
         FROM workspaces
        WHERE id = ? AND tenant_id = ?`,
    )
    .bind(workspaceId, auth.tenantId)
    .first<{
      id: string;
      owner_id: string;
      kyc_tier: number;
      frsc_verified: 0 | 1;
      cac_verified: 0 | 1;
      it_verified: 0 | 1;
    }>();

  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  if (workspace.owner_id !== auth.userId) {
    return c.json({ error: 'Only the workspace owner can activate verticals' }, 403);
  }

  // 2. Verify vertical exists
  const verticalResult = await getVerticalBySlug(db, slug);
  if (!verticalResult.found) {
    return c.json({ error: `Vertical '${slug}' not found` }, 404);
  }
  const vertical = verticalResult.vertical!;

  // 3. Check entitlements
  const entitlements = extractEntitlements(vertical);
  const activationCtx: VerticalActivationContext = {
    workspaceId,
    tenantId: auth.tenantId,
    userId: auth.userId,
    kycTier: (Math.min(3, workspace.kyc_tier ?? 0)) as 0 | 1 | 2 | 3,
    frscVerified: workspace.frsc_verified === 1,
    cacVerified: workspace.cac_verified === 1,
    itVerified: workspace.it_verified === 1,
  };

  const unmet = checkActivationRequirements(entitlements, activationCtx);
  if (unmet.length > 0) {
    return c.json(
      {
        error: 'ENTITLEMENT_REQUIREMENTS_UNMET',
        vertical: slug,
        unmet_requirements: unmet,
      },
      422,
    );
  }

  // 4. Check if already activated
  const existing = await db
    .prepare(
      `SELECT id, state FROM workspace_verticals
        WHERE workspace_id = ? AND tenant_id = ? AND vertical_slug = ?`,
    )
    .bind(workspaceId, auth.tenantId, slug)
    .first<{ id: string; state: string }>();

  if (existing) {
    return c.json(
      {
        error: 'VERTICAL_ALREADY_ACTIVATED',
        vertical: slug,
        current_state: existing.state,
      },
      409,
    );
  }

  // 5. Insert workspace_vertical record at 'claimed' state
  const id = crypto.randomUUID().replace(/-/g, '');
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO workspace_verticals
         (id, workspace_id, tenant_id, vertical_slug, state, created_at)
       VALUES (?, ?, ?, ?, 'claimed', ?)`,
    )
    .bind(id, workspaceId, auth.tenantId, slug, now)
    .run();

  return c.json(
    {
      id,
      workspace_id: workspaceId,
      vertical: slug,
      state: 'claimed',
      display_name: vertical.display_name,
      unmet_for_active: [],
    },
    201,
  );
});

/**
 * GET /workspaces/:id/verticals
 *
 * List all verticals for this workspace (any state).
 */
workspaceVerticalsRoutes.get('/:id/verticals', async (c) => {
  const auth = c.get('auth') as { tenantId: string };
  const workspaceId = c.req.param('id');
  const db = c.env.DB as unknown as D1Like;

  // Verify workspace belongs to tenant (T3)
  const workspace = await db
    .prepare(`SELECT id FROM workspaces WHERE id = ? AND tenant_id = ?`)
    .bind(workspaceId, auth.tenantId)
    .first<{ id: string }>();

  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  const { results } = await db
    .prepare(
      `SELECT wv.*, v.display_name, v.category, v.priority
         FROM workspace_verticals wv
         JOIN verticals v ON v.slug = wv.vertical_slug
        WHERE wv.workspace_id = ? AND wv.tenant_id = ?
        ORDER BY wv.created_at DESC`,
    )
    .bind(workspaceId, auth.tenantId)
    .all<WorkspaceVerticalRow & { display_name: string; category: string; priority: number }>();

  return c.json({ verticals: results, count: results.length });
});
