/**
 * Tailor / Fashion Designer vertical routes — M10 Commerce P2 Batch 2
 *
 * POST   /tailor                               — Create profile
 * GET    /tailor/workspace/:workspaceId        — Get by workspace (T3)
 * GET    /tailor/:id                           — Get profile (T3)
 * PATCH  /tailor/:id                           — Update profile
 * POST   /tailor/:id/transition               — FSM transition (3-state)
 * POST   /tailor/:id/clients                  — Create client (measurements stored cm×10)
 * GET    /tailor/:id/clients                  — List clients
 * POST   /tailor/:id/orders                   — Create order (P9)
 * GET    /tailor/:id/orders                   — List orders
 * PATCH  /tailor/:id/orders/:orderId          — Update order status
 * POST   /tailor/:id/fabric-stock             — Add fabric stock (P9)
 * GET    /tailor/:id/fabric-stock             — List fabric stock
 * GET    /tailor/:id/ai-advisory              — AI demand planning (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 * Measurements stored as integers in cm×10; never passed to AI
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  TailorRepository,
  guardSeedToClaimed,
  isValidTailorTransition,
} from '@webwaka/verticals-tailor';
import type { TailorFSMState, TailorOrderStatus } from '@webwaka/verticals-tailor';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const tailorRoutes = new Hono<{ Bindings: Env }>();

tailorRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; business_name?: string; type?: string; cac_or_trade_assoc_number?: string; state?: string; lga?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.business_name) return c.json({ error: 'workspace_id, business_name are required' }, 400);
  const repo = new TailorRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, businessName: body.business_name, type: body.type as never, cacOrTradeAssocNumber: body.cac_or_trade_assoc_number, state: body.state, lga: body.lga });
  return c.json({ tailor: profile }, 201);
});

tailorRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new TailorRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ tailor: profile });
});

tailorRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new TailorRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Tailor profile not found' }, 404);
  return c.json({ tailor: profile });
});

tailorRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { business_name?: string; type?: string; cac_or_trade_assoc_number?: string; state?: string; lga?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new TailorRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { businessName: body.business_name, type: body.type as never, cacOrTradeAssocNumber: body.cac_or_trade_assoc_number, state: body.state, lga: body.lga });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ tailor: updated });
});

tailorRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new TailorRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as TailorFSMState;
  if (!isValidTailorTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ tailor: updated });
});

tailorRoutes.post('/:id/clients', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_phone?: string; measurements?: Record<string, number> };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_phone) return c.json({ error: 'client_phone is required' }, 400);
  const repo = new TailorRepository(c.env.DB);
  const client = await repo.createClient({ workspaceId: id, tenantId: auth.tenantId, clientPhone: body.client_phone, measurements: body.measurements });
  return c.json({ client }, 201);
});

tailorRoutes.get('/:id/clients', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new TailorRepository(c.env.DB);
  const clients = await repo.listClients(id, auth.tenantId);
  return c.json({ clients, count: clients.length });
});

tailorRoutes.post('/:id/orders', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { client_id?: string; style_description?: string; fabric_type?: string; delivery_date?: number; price_kobo?: number; deposit_kobo?: number; balance_kobo?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.client_id || !body.style_description || body.price_kobo === undefined || body.deposit_kobo === undefined || body.balance_kobo === undefined) return c.json({ error: 'client_id, style_description, price_kobo, deposit_kobo, balance_kobo are required' }, 400);
  const repo = new TailorRepository(c.env.DB);
  try {
    const order = await repo.createOrder({ clientId: body.client_id, workspaceId: id, tenantId: auth.tenantId, styleDescription: body.style_description, fabricType: body.fabric_type, deliveryDate: body.delivery_date, priceKobo: body.price_kobo, depositKobo: body.deposit_kobo, balanceKobo: body.balance_kobo });
    return c.json({ order }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

tailorRoutes.get('/:id/orders', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new TailorRepository(c.env.DB);
  const orders = await repo.listOrders(id, auth.tenantId);
  return c.json({ orders, count: orders.length });
});

tailorRoutes.patch('/:id/orders/:orderId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { orderId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new TailorRepository(c.env.DB);
  const updated = await repo.updateOrderStatus(orderId, auth.tenantId, body.status as TailorOrderStatus);
  if (!updated) return c.json({ error: 'Order not found' }, 404);
  return c.json({ order: updated });
});

tailorRoutes.post('/:id/fabric-stock', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { fabric_name?: string; colour?: string; fabric_type?: string; metres_available_cm?: number; cost_per_metre_kobo?: number; supplier?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.fabric_name || body.cost_per_metre_kobo === undefined) return c.json({ error: 'fabric_name, cost_per_metre_kobo are required' }, 400);
  const repo = new TailorRepository(c.env.DB);
  try {
    const fabric = await repo.createFabricStock({ workspaceId: id, tenantId: auth.tenantId, fabricName: body.fabric_name, colour: body.colour, fabricType: body.fabric_type, metresAvailableCm: body.metres_available_cm, costPerMetreKobo: body.cost_per_metre_kobo, supplier: body.supplier });
    return c.json({ fabric }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

tailorRoutes.get('/:id/fabric-stock', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new TailorRepository(c.env.DB);
  const stock = await repo.listFabricStock(id, auth.tenantId);
  return c.json({ fabric_stock: stock, count: stock.length });
});

// AI advisory — order aggregate; NEVER measurements/client PII (P13)
tailorRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new TailorRepository(c.env.DB);
    const orders = await repo.listOrders(id, auth.tenantId);
    // P13: no client phone, no measurements
    const advisory = orders.map(o => ({ status: o.status, fabric_type: o.fabricType, price_kobo: o.priceKobo }));
    return c.json({ capability: 'DEMAND_PLANNING', advisory_data: advisory, count: advisory.length });
  },
);
