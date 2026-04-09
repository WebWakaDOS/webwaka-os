import type { TailorProfile, CreateTailorInput, UpdateTailorInput, TailorFSMState, TailorClient, CreateTailorClientInput, TailorMeasurements, TailorOrder, CreateTailorOrderInput, TailorOrderStatus, TailorFabricStock, CreateTailorFabricStockInput } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, business_name, type, cac_or_trade_assoc_number, state, lga, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): TailorProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, businessName: r['business_name'] as string, type: r['type'] as TailorProfile['type'], cacOrTradeAssocNumber: r['cac_or_trade_assoc_number'] as string | null, state: r['state'] as string | null, lga: r['lga'] as string | null, status: r['status'] as TailorFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const CLIENT_COLS = 'id, workspace_id, tenant_id, client_phone, measurements, created_at, updated_at';
function rowToClient(r: Record<string, unknown>): TailorClient {
  let measurements: TailorMeasurements = {};
  try { measurements = JSON.parse(r['measurements'] as string) as TailorMeasurements; } catch { measurements = {}; }
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, clientPhone: r['client_phone'] as string, measurements, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const ORDER_COLS = 'id, client_id, workspace_id, tenant_id, style_description, fabric_type, delivery_date, price_kobo, deposit_kobo, balance_kobo, status, created_at, updated_at';
function rowToOrder(r: Record<string, unknown>): TailorOrder {
  return { id: r['id'] as string, clientId: r['client_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, styleDescription: r['style_description'] as string, fabricType: r['fabric_type'] as string | null, deliveryDate: r['delivery_date'] as number | null, priceKobo: r['price_kobo'] as number, depositKobo: r['deposit_kobo'] as number, balanceKobo: r['balance_kobo'] as number, status: r['status'] as TailorOrderStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const FABRIC_COLS = 'id, workspace_id, tenant_id, fabric_name, colour, fabric_type, metres_available_cm, cost_per_metre_kobo, supplier, created_at, updated_at';
function rowToFabric(r: Record<string, unknown>): TailorFabricStock {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, fabricName: r['fabric_name'] as string, colour: r['colour'] as string | null, fabricType: r['fabric_type'] as string | null, metresAvailableCm: r['metres_available_cm'] as number, costPerMetreKobo: r['cost_per_metre_kobo'] as number, supplier: r['supplier'] as string | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class TailorRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateTailorInput): Promise<TailorProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO tailor_profiles (id, workspace_id, tenant_id, business_name, type, cac_or_trade_assoc_number, state, lga, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.businessName, input.type ?? 'all', input.cacOrTradeAssocNumber ?? null, input.state ?? null, input.lga ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[tailor] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<TailorProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM tailor_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<TailorProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM tailor_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateTailorInput): Promise<TailorProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.businessName !== undefined) { sets.push('business_name = ?'); b.push(input.businessName); }
    if (input.type !== undefined) { sets.push('type = ?'); b.push(input.type); }
    if ('cacOrTradeAssocNumber' in input) { sets.push('cac_or_trade_assoc_number = ?'); b.push(input.cacOrTradeAssocNumber ?? null); }
    if ('state' in input) { sets.push('state = ?'); b.push(input.state ?? null); }
    if ('lga' in input) { sets.push('lga = ?'); b.push(input.lga ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE tailor_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: TailorFSMState): Promise<TailorProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createClient(input: CreateTailorClientInput): Promise<TailorClient> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO tailor_clients (id, workspace_id, tenant_id, client_phone, measurements, created_at, updated_at) VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clientPhone, JSON.stringify(input.measurements ?? {})).run();
    const c = await this.findClientById(id, input.tenantId); if (!c) throw new Error('[tailor] client create failed'); return c;
  }

  async findClientById(id: string, tenantId: string): Promise<TailorClient | null> {
    const row = await this.db.prepare(`SELECT ${CLIENT_COLS} FROM tailor_clients WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToClient(row) : null;
  }

  async listClients(workspaceId: string, tenantId: string): Promise<TailorClient[]> {
    const { results } = await this.db.prepare(`SELECT ${CLIENT_COLS} FROM tailor_clients WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToClient);
  }

  async createOrder(input: CreateTailorOrderInput): Promise<TailorOrder> {
    if (!Number.isInteger(input.priceKobo) || input.priceKobo <= 0) throw new Error('[tailor] priceKobo must be positive integer (P9)');
    if (!Number.isInteger(input.depositKobo) || input.depositKobo < 0) throw new Error('[tailor] depositKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.balanceKobo) || input.balanceKobo < 0) throw new Error('[tailor] balanceKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO tailor_orders (id, client_id, workspace_id, tenant_id, style_description, fabric_type, delivery_date, price_kobo, deposit_kobo, balance_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'intake', unixepoch(), unixepoch())`).bind(id, input.clientId, input.workspaceId, input.tenantId, input.styleDescription, input.fabricType ?? null, input.deliveryDate ?? null, input.priceKobo, input.depositKobo, input.balanceKobo).run();
    const o = await this.findOrderById(id, input.tenantId); if (!o) throw new Error('[tailor] order create failed'); return o;
  }

  async findOrderById(id: string, tenantId: string): Promise<TailorOrder | null> {
    const row = await this.db.prepare(`SELECT ${ORDER_COLS} FROM tailor_orders WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToOrder(row) : null;
  }

  async listOrders(workspaceId: string, tenantId: string): Promise<TailorOrder[]> {
    const { results } = await this.db.prepare(`SELECT ${ORDER_COLS} FROM tailor_orders WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToOrder);
  }

  async updateOrderStatus(id: string, tenantId: string, status: TailorOrderStatus): Promise<TailorOrder | null> {
    await this.db.prepare(`UPDATE tailor_orders SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findOrderById(id, tenantId);
  }

  async createFabricStock(input: CreateTailorFabricStockInput): Promise<TailorFabricStock> {
    if (!Number.isInteger(input.costPerMetreKobo) || input.costPerMetreKobo <= 0) throw new Error('[tailor] costPerMetreKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO tailor_fabric_stock (id, workspace_id, tenant_id, fabric_name, colour, fabric_type, metres_available_cm, cost_per_metre_kobo, supplier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.fabricName, input.colour ?? null, input.fabricType ?? null, input.metresAvailableCm ?? 0, input.costPerMetreKobo, input.supplier ?? null).run();
    const f = await this.findFabricStockById(id, input.tenantId); if (!f) throw new Error('[tailor] fabric stock create failed'); return f;
  }

  async findFabricStockById(id: string, tenantId: string): Promise<TailorFabricStock | null> {
    const row = await this.db.prepare(`SELECT ${FABRIC_COLS} FROM tailor_fabric_stock WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToFabric(row) : null;
  }

  async listFabricStock(workspaceId: string, tenantId: string): Promise<TailorFabricStock[]> {
    const { results } = await this.db.prepare(`SELECT ${FABRIC_COLS} FROM tailor_fabric_stock WHERE workspace_id = ? AND tenant_id = ? ORDER BY fabric_name ASC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToFabric);
  }
}
