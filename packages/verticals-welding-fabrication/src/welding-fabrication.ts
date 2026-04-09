import type { WeldingShopProfile, CreateWeldingShopInput, UpdateWeldingShopInput, WeldingFSMState, WeldingJob, CreateWeldingJobInput, WeldingJobStatus, WeldingMaterial, CreateWeldingMaterialInput } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, shop_name, cac_or_trade_number, speciality, state, lga, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): WeldingShopProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, shopName: r['shop_name'] as string, cacOrTradeNumber: r['cac_or_trade_number'] as string | null, speciality: r['speciality'] as WeldingShopProfile['speciality'], state: r['state'] as string | null, lga: r['lga'] as string | null, status: r['status'] as WeldingFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const JOB_COLS = 'id, workspace_id, tenant_id, client_phone, description, material_cost_kobo, labour_cost_kobo, total_kobo, delivery_date, status, created_at, updated_at';
function rowToJob(r: Record<string, unknown>): WeldingJob {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, clientPhone: r['client_phone'] as string, description: r['description'] as string, materialCostKobo: r['material_cost_kobo'] as number, labourCostKobo: r['labour_cost_kobo'] as number, totalKobo: r['total_kobo'] as number, deliveryDate: r['delivery_date'] as number | null, status: r['status'] as WeldingJobStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const MATERIAL_COLS = 'id, workspace_id, tenant_id, material_name, unit, quantity_in_stock, unit_cost_kobo, created_at, updated_at';
function rowToMaterial(r: Record<string, unknown>): WeldingMaterial {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, materialName: r['material_name'] as string, unit: r['unit'] as WeldingMaterial['unit'], quantityInStock: r['quantity_in_stock'] as number, unitCostKobo: r['unit_cost_kobo'] as number, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class WeldingFabricationRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateWeldingShopInput): Promise<WeldingShopProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO welding_shop_profiles (id, workspace_id, tenant_id, shop_name, cac_or_trade_number, speciality, state, lga, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.shopName, input.cacOrTradeNumber ?? null, input.speciality ?? 'general', input.state ?? null, input.lga ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[welding-fabrication] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<WeldingShopProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM welding_shop_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<WeldingShopProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM welding_shop_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateWeldingShopInput): Promise<WeldingShopProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.shopName !== undefined) { sets.push('shop_name = ?'); b.push(input.shopName); }
    if (input.speciality !== undefined) { sets.push('speciality = ?'); b.push(input.speciality); }
    if ('cacOrTradeNumber' in input) { sets.push('cac_or_trade_number = ?'); b.push(input.cacOrTradeNumber ?? null); }
    if ('state' in input) { sets.push('state = ?'); b.push(input.state ?? null); }
    if ('lga' in input) { sets.push('lga = ?'); b.push(input.lga ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE welding_shop_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: WeldingFSMState): Promise<WeldingShopProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createJob(input: CreateWeldingJobInput): Promise<WeldingJob> {
    if (!Number.isInteger(input.materialCostKobo) || input.materialCostKobo < 0) throw new Error('[welding-fabrication] materialCostKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.labourCostKobo) || input.labourCostKobo < 0) throw new Error('[welding-fabrication] labourCostKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.totalKobo) || input.totalKobo <= 0) throw new Error('[welding-fabrication] totalKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO welding_jobs (id, workspace_id, tenant_id, client_phone, description, material_cost_kobo, labour_cost_kobo, total_kobo, delivery_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'quoted', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clientPhone, input.description, input.materialCostKobo, input.labourCostKobo, input.totalKobo, input.deliveryDate ?? null).run();
    const j = await this.findJobById(id, input.tenantId); if (!j) throw new Error('[welding-fabrication] job create failed'); return j;
  }

  async findJobById(id: string, tenantId: string): Promise<WeldingJob | null> {
    const row = await this.db.prepare(`SELECT ${JOB_COLS} FROM welding_jobs WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToJob(row) : null;
  }

  async listJobs(workspaceId: string, tenantId: string): Promise<WeldingJob[]> {
    const { results } = await this.db.prepare(`SELECT ${JOB_COLS} FROM welding_jobs WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToJob);
  }

  async updateJobStatus(id: string, tenantId: string, status: WeldingJobStatus): Promise<WeldingJob | null> {
    await this.db.prepare(`UPDATE welding_jobs SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findJobById(id, tenantId);
  }

  async createMaterial(input: CreateWeldingMaterialInput): Promise<WeldingMaterial> {
    if (!Number.isInteger(input.unitCostKobo) || input.unitCostKobo <= 0) throw new Error('[welding-fabrication] unitCostKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO welding_materials (id, workspace_id, tenant_id, material_name, unit, quantity_in_stock, unit_cost_kobo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.materialName, input.unit, input.quantityInStock ?? 0, input.unitCostKobo).run();
    const m = await this.findMaterialById(id, input.tenantId); if (!m) throw new Error('[welding-fabrication] material create failed'); return m;
  }

  async findMaterialById(id: string, tenantId: string): Promise<WeldingMaterial | null> {
    const row = await this.db.prepare(`SELECT ${MATERIAL_COLS} FROM welding_materials WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToMaterial(row) : null;
  }

  async listMaterials(workspaceId: string, tenantId: string): Promise<WeldingMaterial[]> {
    const { results } = await this.db.prepare(`SELECT ${MATERIAL_COLS} FROM welding_materials WHERE workspace_id = ? AND tenant_id = ? ORDER BY material_name ASC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToMaterial);
  }
}
