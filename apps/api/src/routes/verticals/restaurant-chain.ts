/**
 * Restaurant Chain vertical routes — M9 Commerce P2 Batch 2
 *
 * POST   /restaurant-chain                           — Create profile
 * GET    /restaurant-chain/workspace/:workspaceId    — Get by workspace (T3)
 * GET    /restaurant-chain/:id                       — Get profile (T3)
 * PATCH  /restaurant-chain/:id                       — Update profile
 * POST   /restaurant-chain/:id/transition            — FSM transition
 * POST   /restaurant-chain/:id/outlets               — Create outlet
 * GET    /restaurant-chain/:id/outlets               — List outlets
 * POST   /restaurant-chain/:id/outlets/:outletId/menus     — Add menu item (P9)
 * GET    /restaurant-chain/:id/outlets/:outletId/menus     — List menu
 * POST   /restaurant-chain/:id/outlets/:outletId/orders    — Create order (P9)
 * GET    /restaurant-chain/:id/outlets/:outletId/orders    — List orders
 * PATCH  /restaurant-chain/:id/orders/:orderId              — Update order status
 * GET    /restaurant-chain/:id/ai-advisory           — AI menu optimisation (P10/P12/P13)
 *
 * Platform Invariants: T3, P9, P10, P12, P13
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  RestaurantChainRepository,
  guardSeedToClaimed,
  guardClaimedToNafdacVerified,
  isValidRestaurantChainTransition,
} from '@webwaka/verticals-restaurant-chain';
import type { RestaurantChainFSMState, OrderStatus } from '@webwaka/verticals-restaurant-chain';
import { aiConsentGate } from '@webwaka/superagent';
import type { Env } from '../../env.js';

export const restaurantChainRoutes = new Hono<{ Bindings: Env }>();

restaurantChainRoutes.post('/', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  let body: { workspace_id?: string; brand_name?: string; nafdac_number?: string; cac_rc?: string; outlet_count?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.workspace_id || !body.brand_name) return c.json({ error: 'workspace_id, brand_name are required' }, 400);
  const repo = new RestaurantChainRepository(c.env.DB);
  const profile = await repo.createProfile({ workspaceId: body.workspace_id, tenantId: auth.tenantId, brandName: body.brand_name, nafdacNumber: body.nafdac_number, cacRc: body.cac_rc, outletCount: body.outlet_count });
  return c.json({ restaurant_chain: profile }, 201);
});

restaurantChainRoutes.get('/workspace/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const repo = new RestaurantChainRepository(c.env.DB);
  const profile = await repo.findProfileByWorkspace(workspaceId, auth.tenantId);
  return c.json({ restaurant_chain: profile });
});

restaurantChainRoutes.get('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new RestaurantChainRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Restaurant chain profile not found' }, 404);
  return c.json({ restaurant_chain: profile });
});

restaurantChainRoutes.patch('/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { brand_name?: string; nafdac_number?: string; cac_rc?: string; outlet_count?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  const repo = new RestaurantChainRepository(c.env.DB);
  const updated = await repo.updateProfile(id, auth.tenantId, { brandName: body.brand_name, nafdacNumber: body.nafdac_number, cacRc: body.cac_rc, outletCount: body.outlet_count });
  if (!updated) return c.json({ error: 'Profile not found' }, 404);
  return c.json({ restaurant_chain: updated });
});

restaurantChainRoutes.post('/:id/transition', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string; kycTier?: number };
  const { id } = c.req.param();
  let body: { to_status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.to_status) return c.json({ error: 'to_status is required' }, 400);
  const repo = new RestaurantChainRepository(c.env.DB);
  const profile = await repo.findProfileById(id, auth.tenantId);
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const from = profile.status;
  const to = body.to_status as RestaurantChainFSMState;
  if (!isValidRestaurantChainTransition(from, to)) return c.json({ error: `Invalid FSM transition: ${from} → ${to}` }, 422);
  if (to === 'claimed') {
    const g = guardSeedToClaimed({ kycTier: auth.kycTier ?? 0 });
    if (!g.allowed) return c.json({ error: g.reason }, 403);
  }
  if (to === 'nafdac_verified') {
    const g = guardClaimedToNafdacVerified({ nafdacNumber: profile.nafdacNumber ?? null });
    if (!g.allowed) return c.json({ error: g.reason }, 422);
  }
  const updated = await repo.transitionProfile(id, auth.tenantId, to);
  return c.json({ restaurant_chain: updated });
});

restaurantChainRoutes.post('/:id/outlets', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  let body: { outlet_name?: string; address?: string; state?: string; lga?: string; nafdac_outlet_cert?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.outlet_name) return c.json({ error: 'outlet_name is required' }, 400);
  const repo = new RestaurantChainRepository(c.env.DB);
  const outlet = await repo.createOutlet({ brandId: id, workspaceId: id, tenantId: auth.tenantId, outletName: body.outlet_name, address: body.address, state: body.state, lga: body.lga, nafdacOutletCert: body.nafdac_outlet_cert });
  return c.json({ outlet }, 201);
});

restaurantChainRoutes.get('/:id/outlets', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();
  const repo = new RestaurantChainRepository(c.env.DB);
  const outlets = await repo.listOutlets(id, auth.tenantId);
  return c.json({ outlets, count: outlets.length });
});

restaurantChainRoutes.post('/:id/outlets/:outletId/menus', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, outletId } = c.req.param();
  let body: { item_name?: string; category?: string; price_kobo?: number; prep_time_minutes?: number };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.item_name || body.price_kobo === undefined) return c.json({ error: 'item_name, price_kobo are required' }, 400);
  const repo = new RestaurantChainRepository(c.env.DB);
  try {
    const item = await repo.createMenuItem({ outletId, workspaceId: id, tenantId: auth.tenantId, itemName: body.item_name, category: body.category as never, priceKobo: body.price_kobo, prepTimeMinutes: body.prep_time_minutes });
    return c.json({ menu_item: item }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

restaurantChainRoutes.get('/:id/outlets/:outletId/menus', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { outletId } = c.req.param();
  const repo = new RestaurantChainRepository(c.env.DB);
  const menu = await repo.listMenuItems(outletId, auth.tenantId);
  return c.json({ menu, count: menu.length });
});

restaurantChainRoutes.post('/:id/outlets/:outletId/orders', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id, outletId } = c.req.param();
  let body: { order_type?: string; table_number?: string; items?: string; total_kobo?: number; customer_phone?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.order_type || body.total_kobo === undefined) return c.json({ error: 'order_type, total_kobo are required' }, 400);
  const repo = new RestaurantChainRepository(c.env.DB);
  try {
    const order = await repo.createOrder({ outletId, workspaceId: id, tenantId: auth.tenantId, orderType: body.order_type as never, tableNumber: body.table_number, items: body.items, totalKobo: body.total_kobo, customerPhone: body.customer_phone });
    return c.json({ order }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('P9')) return c.json({ error: err.message }, 422);
    throw err;
  }
});

restaurantChainRoutes.get('/:id/outlets/:outletId/orders', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { outletId } = c.req.param();
  const repo = new RestaurantChainRepository(c.env.DB);
  const orders = await repo.listOrders(outletId, auth.tenantId);
  return c.json({ orders, count: orders.length });
});

restaurantChainRoutes.patch('/:id/orders/:orderId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { orderId } = c.req.param();
  let body: { status?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.status) return c.json({ error: 'status is required' }, 400);
  const repo = new RestaurantChainRepository(c.env.DB);
  const updated = await repo.updateOrderStatus(orderId, auth.tenantId, body.status as OrderStatus);
  if (!updated) return c.json({ error: 'Order not found' }, 404);
  return c.json({ order: updated });
});

// AI advisory — aggregate menu stats; no customer phone (P13)
restaurantChainRoutes.get(
  '/:id/ai-advisory',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as { userId: string; tenantId: string };
    const { id } = c.req.param();
    const repo = new RestaurantChainRepository(c.env.DB);
    const outlets = await repo.listOutlets(id, auth.tenantId);
    // P13: no customer phones; aggregate outlet/menu stats only
    const advisory = outlets.map(o => ({ outlet_name: o.outletName, state: o.state, lga: o.lga }));
    return c.json({ capability: 'MENU_OPTIMIZATION', advisory_data: advisory, count: advisory.length });
  },
);
