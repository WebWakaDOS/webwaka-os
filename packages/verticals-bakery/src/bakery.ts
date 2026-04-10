/**
 * Bakery / Confectionery D1 repository.
 * M9 Commerce P2 — Task V-COMM-EXT-A2
 * Platform Invariants: T3, P9
 * Migration: 0058_vertical_bakery.sql
 */

import type {
  BakeryProfile, BakeryFSMState, CreateBakeryInput, UpdateBakeryInput,
  BakeryProduct, BakeryProductCategory, CreateBakeryProductInput,
  BakeryOrder, BakeryOrderStatus, CreateBakeryOrderInput,
  BakeryIngredient, CreateBakeryIngredientInput,
} from './types.js';

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

interface ProfileRow {
  id: string; workspace_id: string; tenant_id: string; bakery_name: string;
  nafdac_number: string | null; production_license_expiry: number | null;
  cac_number: string | null; food_handler_count: number; status: string;
  created_at: number; updated_at: number;
}
interface ProductRow {
  id: string; workspace_id: string; tenant_id: string; product_name: string;
  category: string; unit_price_kobo: number; production_cost_kobo: number;
  daily_capacity: number; created_at: number;
}
interface OrderRow {
  id: string; workspace_id: string; tenant_id: string; customer_phone: string;
  product_id: string | null; quantity: number; customization_notes: string | null;
  deposit_kobo: number; balance_kobo: number; delivery_date: number | null;
  status: string; created_at: number; updated_at: number;
}
interface IngredientRow {
  id: string; workspace_id: string; tenant_id: string; ingredient_name: string;
  unit: string; quantity_in_stock_x1000: number; unit_cost_kobo: number;
  reorder_level_x1000: number; created_at: number;
}

const r2p = (r: ProfileRow): BakeryProfile => ({
  id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id,
  bakeryName: r.bakery_name, nafdacNumber: r.nafdac_number,
  productionLicenseExpiry: r.production_license_expiry,
  cacNumber: r.cac_number, foodHandlerCount: r.food_handler_count,
  status: r.status as BakeryFSMState, createdAt: r.created_at, updatedAt: r.updated_at,
});
const r2prod = (r: ProductRow): BakeryProduct => ({
  id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id,
  productName: r.product_name, category: r.category as BakeryProductCategory,
  unitPriceKobo: r.unit_price_kobo, productionCostKobo: r.production_cost_kobo,
  dailyCapacity: r.daily_capacity, createdAt: r.created_at,
});
const r2ord = (r: OrderRow): BakeryOrder => ({
  id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id,
  customerPhone: r.customer_phone, productId: r.product_id, quantity: r.quantity,
  customizationNotes: r.customization_notes, depositKobo: r.deposit_kobo,
  balanceKobo: r.balance_kobo, deliveryDate: r.delivery_date,
  status: r.status as BakeryOrderStatus, createdAt: r.created_at, updatedAt: r.updated_at,
});
const r2ing = (r: IngredientRow): BakeryIngredient => ({
  id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id,
  ingredientName: r.ingredient_name, unit: r.unit,
  quantityInStockX1000: r.quantity_in_stock_x1000, unitCostKobo: r.unit_cost_kobo,
  reorderLevelX1000: r.reorder_level_x1000, createdAt: r.created_at,
});

export class BakeryRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateBakeryInput): Promise<BakeryProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(
      `INSERT INTO bakery_profiles
         (id, workspace_id, tenant_id, bakery_name, nafdac_number, cac_number,
          status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`,
    ).bind(id, input.workspaceId, input.tenantId, input.bakeryName,
           input.nafdacNumber ?? null, input.cacNumber ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[bakery] Failed to create profile');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<BakeryProfile | null> {
    const row = await this.db.prepare(
      `SELECT * FROM bakery_profiles WHERE id = ? AND tenant_id = ?`,
    ).bind(id, tenantId).first<ProfileRow>();
    return row ? r2p(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateBakeryInput): Promise<BakeryProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.bakeryName !== undefined) { sets.push('bakery_name = ?'); vals.push(input.bakeryName); }
    if ('nafdacNumber' in input) { sets.push('nafdac_number = ?'); vals.push(input.nafdacNumber ?? null); }
    if ('productionLicenseExpiry' in input) { sets.push('production_license_expiry = ?'); vals.push(input.productionLicenseExpiry ?? null); }
    if ('cacNumber' in input) { sets.push('cac_number = ?'); vals.push(input.cacNumber ?? null); }
    if (input.foodHandlerCount !== undefined) { sets.push('food_handler_count = ?'); vals.push(input.foodHandlerCount); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    vals.push(id, tenantId);
    await this.db.prepare(`UPDATE bakery_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, toStatus: BakeryFSMState): Promise<BakeryProfile | null> {
    return this.updateProfile(id, tenantId, { status: toStatus });
  }

  async createProduct(input: CreateBakeryProductInput): Promise<BakeryProduct> {
    const id = input.id ?? crypto.randomUUID();
    if (!Number.isInteger(input.unitPriceKobo) || input.unitPriceKobo < 0) throw new Error('[P9] unit_price_kobo must be non-negative integer');
    await this.db.prepare(
      `INSERT INTO bakery_products (id, workspace_id, tenant_id, product_name, category, unit_price_kobo, production_cost_kobo, daily_capacity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    ).bind(id, input.workspaceId, input.tenantId, input.productName, input.category,
           input.unitPriceKobo, input.productionCostKobo ?? 0, input.dailyCapacity ?? 0).run();
    const p = await this.findProductById(id, input.tenantId);
    if (!p) throw new Error('[bakery] Failed to create product');
    return p;
  }

  async findProductById(id: string, tenantId: string): Promise<BakeryProduct | null> {
    const row = await this.db.prepare(`SELECT * FROM bakery_products WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<ProductRow>();
    return row ? r2prod(row) : null;
  }

  async listProducts(workspaceId: string, tenantId: string): Promise<BakeryProduct[]> {
    const { results } = await this.db.prepare(`SELECT * FROM bakery_products WHERE workspace_id = ? AND tenant_id = ? ORDER BY product_name ASC`).bind(workspaceId, tenantId).all<ProductRow>();
    return (results ?? []).map(r2prod);
  }

  async createOrder(input: CreateBakeryOrderInput): Promise<BakeryOrder> {
    const id = input.id ?? crypto.randomUUID();
    if (!Number.isInteger(input.depositKobo) || input.depositKobo < 0) throw new Error('[P9] deposit_kobo must be non-negative integer');
    if (!Number.isInteger(input.balanceKobo) || input.balanceKobo < 0) throw new Error('[P9] balance_kobo must be non-negative integer');
    await this.db.prepare(
      `INSERT INTO bakery_orders (id, workspace_id, tenant_id, customer_phone, product_id, quantity, customization_notes, deposit_kobo, balance_kobo, delivery_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', unixepoch(), unixepoch())`,
    ).bind(id, input.workspaceId, input.tenantId, input.customerPhone,
           input.productId ?? null, input.quantity, input.customizationNotes ?? null,
           input.depositKobo, input.balanceKobo, input.deliveryDate ?? null).run();
    const o = await this.findOrderById(id, input.tenantId);
    if (!o) throw new Error('[bakery] Failed to create order');
    return o;
  }

  async findOrderById(id: string, tenantId: string): Promise<BakeryOrder | null> {
    const row = await this.db.prepare(`SELECT * FROM bakery_orders WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<OrderRow>();
    return row ? r2ord(row) : null;
  }

  async listOrders(workspaceId: string, tenantId: string, status?: BakeryOrderStatus): Promise<BakeryOrder[]> {
    let sql = `SELECT * FROM bakery_orders WHERE workspace_id = ? AND tenant_id = ?`;
    const binds: unknown[] = [workspaceId, tenantId];
    if (status) { sql += ` AND status = ?`; binds.push(status); }
    sql += ` ORDER BY created_at DESC`;
    const { results } = await this.db.prepare(sql).bind(...binds).all<OrderRow>();
    return (results ?? []).map(r2ord);
  }

  async updateOrderStatus(id: string, tenantId: string, status: BakeryOrderStatus): Promise<BakeryOrder | null> {
    await this.db.prepare(`UPDATE bakery_orders SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findOrderById(id, tenantId);
  }

  async createIngredient(input: CreateBakeryIngredientInput): Promise<BakeryIngredient> {
    const id = input.id ?? crypto.randomUUID();
    if (!Number.isInteger(input.unitCostKobo) || input.unitCostKobo < 0) throw new Error('[P9] unit_cost_kobo must be non-negative integer');
    await this.db.prepare(
      `INSERT INTO bakery_ingredients (id, workspace_id, tenant_id, ingredient_name, unit, quantity_in_stock_x1000, unit_cost_kobo, reorder_level_x1000, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    ).bind(id, input.workspaceId, input.tenantId, input.ingredientName, input.unit,
           input.quantityInStockX1000, input.unitCostKobo, input.reorderLevelX1000 ?? 1).run();
    const i = await this.findIngredientById(id, input.tenantId);
    if (!i) throw new Error('[bakery] Failed to create ingredient');
    return i;
  }

  async findIngredientById(id: string, tenantId: string): Promise<BakeryIngredient | null> {
    const row = await this.db.prepare(`SELECT * FROM bakery_ingredients WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<IngredientRow>();
    return row ? r2ing(row) : null;
  }

  async listLowStockIngredients(workspaceId: string, tenantId: string): Promise<BakeryIngredient[]> {
    const { results } = await this.db.prepare(
      `SELECT * FROM bakery_ingredients WHERE workspace_id = ? AND tenant_id = ? AND quantity_in_stock_x1000 <= reorder_level_x1000 ORDER BY quantity_in_stock_x1000 ASC`,
    ).bind(workspaceId, tenantId).all<IngredientRow>();
    return (results ?? []).map(r2ing);
  }
}
