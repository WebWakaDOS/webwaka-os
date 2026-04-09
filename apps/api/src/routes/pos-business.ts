/**
 * POS Business Management vertical routes — M8b
 *
 * Products (Inventory):
 *   POST   /pos-business/products                         — Create product
 *   GET    /pos-business/products/:workspaceId            — List by workspace
 *   GET    /pos-business/products/:workspaceId/low-stock  — Low stock alert
 *   GET    /pos-business/product/:id                      — Get product
 *   PATCH  /pos-business/product/:id                      — Update product
 *   POST   /pos-business/product/:id/stock                — Adjust stock
 *   DELETE /pos-business/product/:id                      — Deactivate product
 *
 * Sales:
 *   POST   /pos-business/sales                            — Record sale
 *   GET    /pos-business/sales/:workspaceId               — List sales
 *   GET    /pos-business/sale/:id                         — Get sale
 *   GET    /pos-business/sales/:workspaceId/summary       — Daily summary
 *
 * Customers (CRM):
 *   POST   /pos-business/customers                        — Create customer
 *   GET    /pos-business/customers/:workspaceId           — List customers
 *   GET    /pos-business/customer/:id                     — Get customer
 *   PATCH  /pos-business/customer/:id                     — Update customer
 *   POST   /pos-business/customer/:id/loyalty/award       — Award loyalty points
 *   POST   /pos-business/customer/:id/loyalty/redeem      — Redeem loyalty points
 *
 * All routes require authMiddleware (wired in index.ts).
 * Platform Invariants: T3 (tenantId from auth), P9 (integer kobo/points)
 */

import { Hono } from 'hono';
import {
  InventoryRepository,
  SalesRepository,
  CustomerRepository,
} from '@webwaka/verticals-pos-business';
import type { PaymentMethod, SaleItem } from '@webwaka/verticals-pos-business';
import type { Env } from '../env.js';

export const posBusinessRoutes = new Hono<{ Bindings: Env }>();

// ===========================================================================
// PRODUCTS / INVENTORY
// ===========================================================================

posBusinessRoutes.post('/products', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };

  let body: {
    workspace_id?: string;
    name?: string;
    sku?: string;
    price_kobo?: number;
    stock_qty?: number;
    category?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.workspace_id || !body.name || body.price_kobo === undefined) {
    return c.json({ error: 'workspace_id, name, price_kobo are required' }, 400);
  }

  const repo = new InventoryRepository(c.env.DB);
  try {
    const product = await repo.create({
      workspaceId: body.workspace_id,
      tenantId: auth.tenantId,
      name: body.name,
      priceKobo: body.price_kobo,
      ...(body.sku !== undefined ? { sku: body.sku } : {}),
      ...(body.stock_qty !== undefined ? { stockQty: body.stock_qty } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
    });
    return c.json({ product }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return c.json({ error: message }, 400);
  }
});

posBusinessRoutes.get('/products/:workspaceId/low-stock', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const thresholdStr = c.req.query('threshold') ?? '5';
  const threshold = parseInt(thresholdStr, 10) || 5;

  const repo = new InventoryRepository(c.env.DB);
  const products = await repo.findLowStock(workspaceId, auth.tenantId, threshold);

  return c.json({ products, count: products.length, threshold });
});

posBusinessRoutes.get('/products/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const activeOnly = c.req.query('active') !== '0';

  const repo = new InventoryRepository(c.env.DB);
  const products = await repo.findByWorkspace(workspaceId, auth.tenantId, activeOnly);

  return c.json({ products, count: products.length });
});

posBusinessRoutes.get('/product/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  const repo = new InventoryRepository(c.env.DB);
  const product = await repo.findById(id, auth.tenantId);

  if (!product) return c.json({ error: 'Product not found' }, 404);
  return c.json({ product });
});

posBusinessRoutes.patch('/product/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  let body: {
    name?: string;
    sku?: string | null;
    price_kobo?: number;
    stock_qty?: number;
    category?: string | null;
    active?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const repo = new InventoryRepository(c.env.DB);
  try {
    const updated = await repo.update(id, auth.tenantId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...('sku' in body ? { sku: body.sku ?? null } : {}),
      ...(body.price_kobo !== undefined ? { priceKobo: body.price_kobo } : {}),
      ...(body.stock_qty !== undefined ? { stockQty: body.stock_qty } : {}),
      ...('category' in body ? { category: body.category ?? null } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    });
    if (!updated) return c.json({ error: 'Product not found' }, 404);
    return c.json({ product: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return c.json({ error: message }, 400);
  }
});

posBusinessRoutes.post('/product/:id/stock', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  let body: { delta?: number; reason?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (body.delta === undefined) return c.json({ error: 'delta is required' }, 400);

  const repo = new InventoryRepository(c.env.DB);
  try {
    const updated = await repo.adjustStock(id, auth.tenantId, {
      delta: body.delta,
      reason: body.reason ?? 'manual adjustment',
    });
    if (!updated) return c.json({ error: 'Product not found' }, 404);
    return c.json({ product: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stock adjustment failed';
    return c.json({ error: message }, 400);
  }
});

posBusinessRoutes.delete('/product/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  const repo = new InventoryRepository(c.env.DB);
  await repo.deactivate(id, auth.tenantId);
  return c.json({ deactivated: true, id });
});

// ===========================================================================
// SALES
// ===========================================================================

posBusinessRoutes.post('/sales', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };

  let body: {
    workspace_id?: string;
    payment_method?: string;
    items?: Array<{ product_id: string; qty: number; price_kobo: number }>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.workspace_id || !body.payment_method || !body.items || body.items.length === 0) {
    return c.json({ error: 'workspace_id, payment_method, items are required' }, 400);
  }

  const validMethods: PaymentMethod[] = ['cash', 'card', 'transfer'];
  if (!validMethods.includes(body.payment_method as PaymentMethod)) {
    return c.json({ error: `payment_method must be one of: ${validMethods.join(', ')}` }, 400);
  }

  const items: SaleItem[] = body.items.map((item) => ({
    productId: item.product_id,
    qty: item.qty,
    priceKobo: item.price_kobo,
  }));

  const repo = new SalesRepository(c.env.DB);
  try {
    const sale = await repo.recordSale({
      workspaceId: body.workspace_id,
      tenantId: auth.tenantId,
      cashierId: auth.userId,
      paymentMethod: body.payment_method as PaymentMethod,
      items,
    });
    return c.json({ sale }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record sale';
    return c.json({ error: message }, 400);
  }
});

posBusinessRoutes.get('/sales/:workspaceId/summary', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();

  const dateStr = c.req.query('date') ?? new Date().toISOString().split('T')[0];
  const dayStart = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
  const dayEnd = dayStart + 86400;

  const repo = new SalesRepository(c.env.DB);
  const summary = await repo.dailySummary(workspaceId, auth.tenantId, dayStart, dayEnd);

  return c.json({ date: dateStr, ...summary });
});

posBusinessRoutes.get('/sales/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const limitStr = c.req.query('limit') ?? '50';
  const limit = Math.min(parseInt(limitStr, 10) || 50, 200);

  const repo = new SalesRepository(c.env.DB);
  const sales = await repo.listByWorkspace(workspaceId, auth.tenantId, limit);

  return c.json({ sales, count: sales.length });
});

posBusinessRoutes.get('/sale/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  const repo = new SalesRepository(c.env.DB);
  const sale = await repo.findById(id, auth.tenantId);

  if (!sale) return c.json({ error: 'Sale not found' }, 404);
  return c.json({ sale });
});

// ===========================================================================
// CUSTOMERS (CRM)
// ===========================================================================

posBusinessRoutes.post('/customers', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };

  let body: { workspace_id?: string; phone?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.workspace_id) {
    return c.json({ error: 'workspace_id is required' }, 400);
  }

  const repo = new CustomerRepository(c.env.DB);
  const customer = await repo.create({
    workspaceId: body.workspace_id,
    tenantId: auth.tenantId,
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.name !== undefined ? { name: body.name } : {}),
  });

  return c.json({ customer }, 201);
});

posBusinessRoutes.get('/customers/:workspaceId', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { workspaceId } = c.req.param();
  const limitStr = c.req.query('limit') ?? '50';
  const limit = Math.min(parseInt(limitStr, 10) || 50, 200);

  const repo = new CustomerRepository(c.env.DB);
  const customers = await repo.listByWorkspace(workspaceId, auth.tenantId, limit);

  return c.json({ customers, count: customers.length });
});

posBusinessRoutes.get('/customer/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  const repo = new CustomerRepository(c.env.DB);
  const customer = await repo.findById(id, auth.tenantId);

  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  return c.json({ customer });
});

posBusinessRoutes.patch('/customer/:id', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  let body: { phone?: string | null; name?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const repo = new CustomerRepository(c.env.DB);
  const updated = await repo.update(id, auth.tenantId, {
    ...('phone' in body ? { phone: body.phone ?? null } : {}),
    ...('name' in body ? { name: body.name ?? null } : {}),
  });

  if (!updated) return c.json({ error: 'Customer not found' }, 404);
  return c.json({ customer: updated });
});

posBusinessRoutes.post('/customer/:id/loyalty/award', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  let body: { points?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.points) return c.json({ error: 'points is required' }, 400);

  const repo = new CustomerRepository(c.env.DB);
  try {
    const updated = await repo.awardPoints(id, auth.tenantId, body.points);
    if (!updated) return c.json({ error: 'Customer not found' }, 404);
    return c.json({ customer: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Award failed';
    return c.json({ error: message }, 400);
  }
});

posBusinessRoutes.post('/customer/:id/loyalty/redeem', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const { id } = c.req.param();

  let body: { points?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.points) return c.json({ error: 'points is required' }, 400);

  const repo = new CustomerRepository(c.env.DB);
  try {
    const { success, customer } = await repo.redeemPoints(id, auth.tenantId, body.points);
    if (!customer) return c.json({ error: 'Customer not found' }, 404);
    if (!success) return c.json({ error: 'INSUFFICIENT_POINTS', customer }, 409);
    return c.json({ success: true, customer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Redeem failed';
    return c.json({ error: message }, 400);
  }
});
