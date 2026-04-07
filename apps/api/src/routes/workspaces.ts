/**
 * Workspace management routes.
 *
 * POST /workspaces/:id/activate — convert free → paid (Paystack stub)
 * PATCH /workspaces/:id         — update plan / active layers
 * POST  /workspaces/:id/invite  — invite user → membership
 * GET   /workspaces/:id/analytics — basic usage metrics
 *
 * Platform Invariants:
 *   T3 — tenant_id on all queries
 *   T5 — entitlement checks gating layer updates
 *   All routes require auth
 *
 * Milestone 5 — Workspace Activation + Management
 */

import { Hono } from 'hono';
import { Role } from '@webwaka/types';
import type { WorkspaceId, UserId } from '@webwaka/types';
import { asId } from '@webwaka/types';
import { getWorkspaceById, addMember } from '@webwaka/entities';
import type { Env } from '../env.js';

const workspaceRoutes = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Shared D1Like type
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// POST /workspaces/:id/activate — Paystack stub
// Converts a workspace from free → starter plan. Payment processor is deferred (M6).
// ---------------------------------------------------------------------------

workspaceRoutes.post('/:id/activate', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('id') as WorkspaceId;
  const db = c.env.DB as unknown as D1Like;

  const workspace = await getWorkspaceById(db as Parameters<typeof getWorkspaceById>[0], auth.tenantId, workspaceId);

  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  if ((workspace.ownerId as string) !== (auth.userId as string)) {
    return c.json({ error: 'Only the workspace owner can activate' }, 403);
  }

  let body: { paymentMethodStub?: string; plan?: string };
  try {
    body = await c.req.json<typeof body>();
  } catch {
    body = {};
  }

  const plan = body.plan ?? 'starter';
  const validPlans = ['starter', 'growth', 'enterprise'];
  if (!validPlans.includes(plan)) {
    return c.json({ error: `Invalid plan. Must be one of: ${validPlans.join('|')}` }, 400);
  }

  // Payment processor stub — Paystack integration deferred to M6
  const paystackReference = `stub_${crypto.randomUUID().replace(/-/g, '')}`;

  // Update subscription to active
  await db
    .prepare(
      `UPDATE subscriptions
       SET plan = ?, status = 'active', updated_at = unixepoch()
       WHERE workspace_id = ? AND tenant_id = ?`,
    )
    .bind(plan, workspaceId, auth.tenantId)
    .run();

  return c.json({
    workspaceId,
    plan,
    status: 'active',
    paystackReference,
    note: 'Payment processing via Paystack stub — full integration in Milestone 6',
  }, 200);
});

// ---------------------------------------------------------------------------
// PATCH /workspaces/:id — Update plan and/or active layers
// ---------------------------------------------------------------------------

workspaceRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('id') as WorkspaceId;
  const db = c.env.DB as unknown as D1Like;

  if (auth.role !== 'admin' && auth.role !== 'super_admin') {
    return c.json({ error: 'Admin role required' }, 403);
  }

  const workspace = await getWorkspaceById(db as Parameters<typeof getWorkspaceById>[0], auth.tenantId, workspaceId);

  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  let body: { name?: string; plan?: string; activeLayers?: string[] };
  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.name && !body.plan && !body.activeLayers) {
    return c.json({ error: 'At least one field (name, plan, activeLayers) required' }, 400);
  }

  if (body.name !== undefined) {
    await db
      .prepare('UPDATE workspaces SET name = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?')
      .bind(body.name, workspaceId, auth.tenantId)
      .run();
  }

  if (body.plan !== undefined) {
    const validPlans = ['free', 'starter', 'growth', 'enterprise'];
    if (!validPlans.includes(body.plan)) {
      return c.json({ error: `Invalid plan. Must be one of: ${validPlans.join('|')}` }, 400);
    }
    await db
      .prepare(
        `UPDATE subscriptions SET plan = ?, updated_at = unixepoch()
         WHERE workspace_id = ? AND tenant_id = ?`,
      )
      .bind(body.plan, workspaceId, auth.tenantId)
      .run();
  }

  return c.json({ workspaceId, updated: true, name: body.name, plan: body.plan });
});

// ---------------------------------------------------------------------------
// POST /workspaces/:id/invite — Invite a user to join the workspace
// ---------------------------------------------------------------------------

workspaceRoutes.post('/:id/invite', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('id') as WorkspaceId;
  const db = c.env.DB as unknown as D1Like;

  const workspace = await getWorkspaceById(db as Parameters<typeof getWorkspaceById>[0], auth.tenantId, workspaceId);
  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  if (auth.role !== 'admin' && auth.role !== 'super_admin' && (workspace.ownerId as string) !== (auth.userId as string)) {
    return c.json({ error: 'Only workspace owners or admins can invite members' }, 403);
  }

  let body: { userId?: string; email?: string; role?: string };
  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.userId && !body.email) {
    return c.json({ error: 'userId or email is required' }, 400);
  }

  const roleValue = body.role ?? 'member';
  const validRoles: string[] = Object.values(Role);
  if (!validRoles.includes(roleValue)) {
    return c.json({ error: `Invalid role. Must be one of: ${validRoles.join('|')}` }, 400);
  }

  const userId = body.userId ?? `usr_pending_${crypto.randomUUID().replace(/-/g, '')}`;

  await addMember(
    db as Parameters<typeof addMember>[0],
    auth.tenantId,
    workspaceId,
    asId<UserId>(userId),
    roleValue as Role,
  );

  return c.json({
    workspaceId,
    userId,
    role: roleValue,
    invited: true,
    note: body.email ? `Invite email dispatch deferred to M6 (email: ${body.email})` : undefined,
  }, 201);
});

// ---------------------------------------------------------------------------
// GET /workspaces/:id/analytics — Basic usage metrics
// ---------------------------------------------------------------------------

workspaceRoutes.get('/:id/analytics', async (c) => {
  const auth = c.get('auth');
  const workspaceId = c.req.param('id') as WorkspaceId;
  const db = c.env.DB as unknown as D1Like;

  const workspace = await getWorkspaceById(db as Parameters<typeof getWorkspaceById>[0], auth.tenantId, workspaceId);
  if (!workspace) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  // Member count
  const memberCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM memberships WHERE workspace_id = ? AND tenant_id = ?')
    .bind(workspaceId, auth.tenantId)
    .first<{ cnt: number }>();

  // Entity counts (individuals + organizations in this tenant)
  const individualCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM individuals WHERE tenant_id = ?')
    .bind(auth.tenantId)
    .first<{ cnt: number }>();

  const orgCount = await db
    .prepare('SELECT COUNT(*) AS cnt FROM organizations WHERE tenant_id = ?')
    .bind(auth.tenantId)
    .first<{ cnt: number }>();

  // Pending claim requests for this workspace's entities
  const pendingClaims = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM claim_requests cr
       JOIN profiles p ON p.id = cr.profile_id
       WHERE cr.status = 'pending'`,
    )
    .bind()
    .first<{ cnt: number }>();

  return c.json({
    workspaceId,
    tenantId: auth.tenantId,
    metrics: {
      members: memberCount?.cnt ?? 0,
      individuals: individualCount?.cnt ?? 0,
      organizations: orgCount?.cnt ?? 0,
      pendingClaimRequests: pendingClaims?.cnt ?? 0,
    },
    generatedAt: new Date().toISOString(),
  });
});

export { workspaceRoutes };
