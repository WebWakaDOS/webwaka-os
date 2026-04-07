/**
 * Entity routes (individuals + organizations).
 * Auth required (JWT middleware applied in index.ts).
 *
 * T3: all queries are scoped to the authenticated tenant.
 * T5: entitlement checks gate Operational and higher layer routes.
 *
 * POST /entities/individuals           — create individual
 * GET  /entities/individuals           — list individuals (tenant-scoped)
 * GET  /entities/individuals/:id       — get individual by ID
 *
 * POST /entities/organizations         — create organization
 * GET  /entities/organizations         — list organizations (tenant-scoped)
 * GET  /entities/organizations/:id     — get organization by ID
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AuthContext } from '@webwaka/types';
import {
  createIndividual,
  getIndividualById,
  listIndividualsByTenant,
  createOrganization,
  getOrganizationById,
  listOrganizationsByTenant,
} from '@webwaka/entities';
import { requireLayerAccess } from '@webwaka/entitlements';
import { PlatformLayer, SubscriptionPlan, SubscriptionStatus } from '@webwaka/types';
import type { IndividualId, OrganizationId, EntitlementContext } from '@webwaka/types';
import { asId } from '@webwaka/types';
import { EntitlementError } from '@webwaka/entitlements';
import { indexIndividual, indexOrganization } from '../lib/search-index.js';
import type { Env } from '../env.js';

const entityRoutes = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// ---------------------------------------------------------------------------
// Helper: build an EntitlementContext from the AuthContext + subscription info.
// In production, this loads the workspace subscription from D1.
// For the initial API wiring we read it from the workspace's subscription record.
// ---------------------------------------------------------------------------

type EntityContext = Context<{ Bindings: Env; Variables: { auth: AuthContext } }>;

async function getEntitlementContext(
  c: EntityContext,
): Promise<EntitlementContext> {
  const auth = c.get('auth');

  // Look up workspace subscription from D1
  const subRow = await c.env.DB.prepare(
    `SELECT plan, status FROM subscriptions WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`,
  )
    .bind(auth.workspaceId, auth.tenantId)
    .first<{ plan: string; status: string }>();

  const plan = (subRow?.plan as SubscriptionPlan) ?? SubscriptionPlan.Free;
  const status = (subRow?.status as SubscriptionStatus) ?? SubscriptionStatus.Active;

  // Resolve active layers from plan config
  const { PLAN_CONFIGS } = await import('@webwaka/entitlements');
  const config = PLAN_CONFIGS[plan];

  return {
    ...auth,
    subscriptionPlan: plan,
    subscriptionStatus: status,
    activeLayers: config.layers,
  };
}

// ---------------------------------------------------------------------------
// Individuals
// ---------------------------------------------------------------------------

entityRoutes.post('/individuals', async (c) => {
  const auth = c.get('auth');

  try {
    const ctx = await getEntitlementContext(c);
    requireLayerAccess(ctx, PlatformLayer.Operational);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return c.json({ error: err.message }, 403);
    }
    throw err;
  }

  const body = await c.req.json<{ name: string; placeId?: string; metadata?: Record<string, unknown> }>();
  if (!body.name || typeof body.name !== 'string') {
    return c.json({ error: 'name is required and must be a string.' }, 400);
  }

  const individual = await createIndividual(c.env.DB, auth.tenantId, {
    name: body.name,
    ...(body.placeId !== undefined ? { placeId: body.placeId } : {}),
    ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    await indexIndividual(c.env.DB as any, individual as any, auth.tenantId);
  } catch (err) {
    console.error('[entities] search index failed for individual:', err);
  }

  return c.json({ data: individual }, 201);
});

entityRoutes.get('/individuals', async (c) => {
  const auth = c.get('auth');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const cursor = c.req.query('cursor');
  const listOpts = { limit, ...(cursor !== undefined ? { cursor } : {}) };

  const result = await listIndividualsByTenant(c.env.DB, auth.tenantId, listOpts);
  return c.json({ data: result.items, nextCursor: result.nextCursor });
});

entityRoutes.get('/individuals/:id', async (c) => {
  const auth = c.get('auth');
  const id = asId<IndividualId>(c.req.param('id'));

  const individual = await getIndividualById(c.env.DB, auth.tenantId, id);
  if (!individual) {
    return c.json({ error: `Individual '${id}' not found.` }, 404);
  }

  return c.json({ data: individual });
});

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

entityRoutes.post('/organizations', async (c) => {
  const auth = c.get('auth');

  try {
    const ctx = await getEntitlementContext(c);
    requireLayerAccess(ctx, PlatformLayer.Operational);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return c.json({ error: err.message }, 403);
    }
    throw err;
  }

  const body = await c.req.json<{ name: string; placeId?: string; metadata?: Record<string, unknown> }>();
  if (!body.name || typeof body.name !== 'string') {
    return c.json({ error: 'name is required and must be a string.' }, 400);
  }

  const org = await createOrganization(c.env.DB, auth.tenantId, {
    name: body.name,
    ...(body.placeId !== undefined ? { placeId: body.placeId } : {}),
    ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    await indexOrganization(c.env.DB as any, org as any, auth.tenantId);
  } catch (err) {
    console.error('[entities] search index failed for organization:', err);
  }

  return c.json({ data: org }, 201);
});

entityRoutes.get('/organizations', async (c) => {
  const auth = c.get('auth');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const cursor = c.req.query('cursor');
  const listOpts = { limit, ...(cursor !== undefined ? { cursor } : {}) };

  const result = await listOrganizationsByTenant(c.env.DB, auth.tenantId, listOpts);
  return c.json({ data: result.items, nextCursor: result.nextCursor });
});

entityRoutes.get('/organizations/:id', async (c) => {
  const auth = c.get('auth');
  const id = asId<OrganizationId>(c.req.param('id'));

  const org = await getOrganizationById(c.env.DB, auth.tenantId, id);
  if (!org) {
    return c.json({ error: `Organization '${id}' not found.` }, 404);
  }

  return c.json({ data: org });
});

export { entityRoutes };
