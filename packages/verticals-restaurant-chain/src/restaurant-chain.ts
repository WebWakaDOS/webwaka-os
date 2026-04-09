import type { RestaurantChainProfile, CreateRestaurantChainInput, UpdateRestaurantChainInput, RestaurantChainFSMState, RestaurantOutlet, CreateRestaurantOutletInput, RestaurantChainMenuItem, CreateRestaurantChainMenuItemInput, RestaurantChainOrder, CreateRestaurantChainOrderInput, OrderStatus } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, brand_name, nafdac_number, cac_rc, outlet_count, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): RestaurantChainProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, brandName: r['brand_name'] as string, nafdacNumber: r['nafdac_number'] as string | null, cacRc: r['cac_rc'] as string | null, outletCount: r['outlet_count'] as number, status: r['status'] as RestaurantChainFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const OUTLET_COLS = 'id, brand_id, workspace_id, tenant_id, outlet_name, address, state, lga, nafdac_outlet_cert, created_at, updated_at';
function rowToOutlet(r: Record<string, unknown>): RestaurantOutlet {
  return { id: r['id'] as string, brandId: r['brand_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, outletName: r['outlet_name'] as string, address: r['address'] as string | null, state: r['state'] as string | null, lga: r['lga'] as string | null, nafdacOutletCert: r['nafdac_outlet_cert'] as string | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const MENU_COLS = 'id, outlet_id, workspace_id, tenant_id, item_name, category, price_kobo, available, prep_time_minutes, created_at, updated_at';
function rowToMenuItem(r: Record<string, unknown>): RestaurantChainMenuItem {
  return { id: r['id'] as string, outletId: r['outlet_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, itemName: r['item_name'] as string, category: r['category'] as RestaurantChainMenuItem['category'], priceKobo: r['price_kobo'] as number, available: r['available'] === 1, prepTimeMinutes: r['prep_time_minutes'] as number, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const ORDER_COLS = 'id, outlet_id, workspace_id, tenant_id, table_number, order_type, items, total_kobo, status, customer_phone, created_at, updated_at';
function rowToOrder(r: Record<string, unknown>): RestaurantChainOrder {
  return { id: r['id'] as string, outletId: r['outlet_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, tableNumber: r['table_number'] as string | null, orderType: r['order_type'] as RestaurantChainOrder['orderType'], items: r['items'] as string, totalKobo: r['total_kobo'] as number, status: r['status'] as OrderStatus, customerPhone: r['customer_phone'] as string | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class RestaurantChainRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateRestaurantChainInput): Promise<RestaurantChainProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO restaurant_chain_profiles (id, workspace_id, tenant_id, brand_name, nafdac_number, cac_rc, outlet_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.brandName, input.nafdacNumber ?? null, input.cacRc ?? null, input.outletCount ?? 1).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[restaurant-chain] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<RestaurantChainProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM restaurant_chain_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<RestaurantChainProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM restaurant_chain_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateRestaurantChainInput): Promise<RestaurantChainProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.brandName !== undefined) { sets.push('brand_name = ?'); b.push(input.brandName); }
    if ('nafdacNumber' in input) { sets.push('nafdac_number = ?'); b.push(input.nafdacNumber ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc = ?'); b.push(input.cacRc ?? null); }
    if (input.outletCount !== undefined) { sets.push('outlet_count = ?'); b.push(input.outletCount); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE restaurant_chain_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: RestaurantChainFSMState): Promise<RestaurantChainProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createOutlet(input: CreateRestaurantOutletInput): Promise<RestaurantOutlet> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO restaurant_chain_outlets (id, brand_id, workspace_id, tenant_id, outlet_name, address, state, lga, nafdac_outlet_cert, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.brandId, input.workspaceId, input.tenantId, input.outletName, input.address ?? null, input.state ?? null, input.lga ?? null, input.nafdacOutletCert ?? null).run();
    const o = await this.findOutletById(id, input.tenantId); if (!o) throw new Error('[restaurant-chain] outlet create failed'); return o;
  }

  async findOutletById(id: string, tenantId: string): Promise<RestaurantOutlet | null> {
    const row = await this.db.prepare(`SELECT ${OUTLET_COLS} FROM restaurant_chain_outlets WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToOutlet(row) : null;
  }

  async listOutlets(brandId: string, tenantId: string): Promise<RestaurantOutlet[]> {
    const { results } = await this.db.prepare(`SELECT ${OUTLET_COLS} FROM restaurant_chain_outlets WHERE brand_id = ? AND tenant_id = ? ORDER BY outlet_name ASC`).bind(brandId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToOutlet);
  }

  async createMenuItem(input: CreateRestaurantChainMenuItemInput): Promise<RestaurantChainMenuItem> {
    if (!Number.isInteger(input.priceKobo) || input.priceKobo <= 0) throw new Error('[restaurant-chain] priceKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO restaurant_chain_menus (id, outlet_id, workspace_id, tenant_id, item_name, category, price_kobo, available, prep_time_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, unixepoch(), unixepoch())`).bind(id, input.outletId, input.workspaceId, input.tenantId, input.itemName, input.category ?? 'main', input.priceKobo, input.prepTimeMinutes ?? 15).run();
    const m = await this.findMenuItemById(id, input.tenantId); if (!m) throw new Error('[restaurant-chain] menu item create failed'); return m;
  }

  async findMenuItemById(id: string, tenantId: string): Promise<RestaurantChainMenuItem | null> {
    const row = await this.db.prepare(`SELECT ${MENU_COLS} FROM restaurant_chain_menus WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToMenuItem(row) : null;
  }

  async listMenuItems(outletId: string, tenantId: string): Promise<RestaurantChainMenuItem[]> {
    const { results } = await this.db.prepare(`SELECT ${MENU_COLS} FROM restaurant_chain_menus WHERE outlet_id = ? AND tenant_id = ? ORDER BY category, item_name`).bind(outletId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToMenuItem);
  }

  async createOrder(input: CreateRestaurantChainOrderInput): Promise<RestaurantChainOrder> {
    if (!Number.isInteger(input.totalKobo) || input.totalKobo <= 0) throw new Error('[restaurant-chain] totalKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO restaurant_chain_orders (id, outlet_id, workspace_id, tenant_id, table_number, order_type, items, total_kobo, status, customer_phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'placed', ?, unixepoch(), unixepoch())`).bind(id, input.outletId, input.workspaceId, input.tenantId, input.tableNumber ?? null, input.orderType, input.items ?? '[]', input.totalKobo, input.customerPhone ?? null).run();
    const o = await this.findOrderById(id, input.tenantId); if (!o) throw new Error('[restaurant-chain] order create failed'); return o;
  }

  async findOrderById(id: string, tenantId: string): Promise<RestaurantChainOrder | null> {
    const row = await this.db.prepare(`SELECT ${ORDER_COLS} FROM restaurant_chain_orders WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToOrder(row) : null;
  }

  async listOrders(outletId: string, tenantId: string): Promise<RestaurantChainOrder[]> {
    const { results } = await this.db.prepare(`SELECT ${ORDER_COLS} FROM restaurant_chain_orders WHERE outlet_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(outletId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToOrder);
  }

  async updateOrderStatus(id: string, tenantId: string, status: OrderStatus): Promise<RestaurantChainOrder | null> {
    await this.db.prepare(`UPDATE restaurant_chain_orders SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findOrderById(id, tenantId);
  }
}
