import type { PrintShopProfile, CreatePrintShopInput, UpdatePrintShopInput, PrintShopFSMState, PrintJob, CreatePrintJobInput, PrintJobStatus, PrintStock, CreatePrintStockInput } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, shop_name, cac_number, son_registered, speciality, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): PrintShopProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, shopName: r['shop_name'] as string, cacNumber: r['cac_number'] as string | null, sonRegistered: r['son_registered'] === 1, speciality: r['speciality'] as PrintShopProfile['speciality'], status: r['status'] as PrintShopFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const JOB_COLS = 'id, workspace_id, tenant_id, client_phone, job_type, quantity, size, paper_type, colour_mode, unit_price_kobo, total_kobo, design_ref, status, created_at, updated_at';
function rowToJob(r: Record<string, unknown>): PrintJob {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, clientPhone: r['client_phone'] as string, jobType: r['job_type'] as PrintJob['jobType'], quantity: r['quantity'] as number, size: r['size'] as string | null, paperType: r['paper_type'] as string | null, colourMode: r['colour_mode'] as PrintJob['colourMode'], unitPriceKobo: r['unit_price_kobo'] as number, totalKobo: r['total_kobo'] as number, designRef: r['design_ref'] as string | null, status: r['status'] as PrintJobStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const STOCK_COLS = 'id, workspace_id, tenant_id, paper_type, gsm, sheet_size, quantity_in_stock, unit_cost_kobo, created_at, updated_at';
function rowToStock(r: Record<string, unknown>): PrintStock {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, paperType: r['paper_type'] as string, gsm: r['gsm'] as number | null, sheetSize: r['sheet_size'] as string | null, quantityInStock: r['quantity_in_stock'] as number, unitCostKobo: r['unit_cost_kobo'] as number, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class PrintShopRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreatePrintShopInput): Promise<PrintShopProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO print_shop_profiles (id, workspace_id, tenant_id, shop_name, cac_number, son_registered, speciality, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.shopName, input.cacNumber ?? null, input.sonRegistered ? 1 : 0, input.speciality ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[print-shop] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<PrintShopProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM print_shop_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<PrintShopProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM print_shop_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdatePrintShopInput): Promise<PrintShopProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.shopName !== undefined) { sets.push('shop_name = ?'); b.push(input.shopName); }
    if ('cacNumber' in input) { sets.push('cac_number = ?'); b.push(input.cacNumber ?? null); }
    if (input.sonRegistered !== undefined) { sets.push('son_registered = ?'); b.push(input.sonRegistered ? 1 : 0); }
    if ('speciality' in input) { sets.push('speciality = ?'); b.push(input.speciality ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE print_shop_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: PrintShopFSMState): Promise<PrintShopProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createJob(input: CreatePrintJobInput): Promise<PrintJob> {
    if (!Number.isInteger(input.unitPriceKobo) || input.unitPriceKobo <= 0) throw new Error('[print-shop] unitPriceKobo must be positive integer (P9)');
    if (!Number.isInteger(input.totalKobo) || input.totalKobo <= 0) throw new Error('[print-shop] totalKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO print_jobs (id, workspace_id, tenant_id, client_phone, job_type, quantity, size, paper_type, colour_mode, unit_price_kobo, total_kobo, design_ref, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clientPhone, input.jobType, input.quantity ?? 1, input.size ?? null, input.paperType ?? null, input.colourMode ?? null, input.unitPriceKobo, input.totalKobo, input.designRef ?? null).run();
    const j = await this.findJobById(id, input.tenantId); if (!j) throw new Error('[print-shop] job create failed'); return j;
  }

  async findJobById(id: string, tenantId: string): Promise<PrintJob | null> {
    const row = await this.db.prepare(`SELECT ${JOB_COLS} FROM print_jobs WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToJob(row) : null;
  }

  async listJobs(workspaceId: string, tenantId: string): Promise<PrintJob[]> {
    const { results } = await this.db.prepare(`SELECT ${JOB_COLS} FROM print_jobs WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToJob);
  }

  async updateJobStatus(id: string, tenantId: string, status: PrintJobStatus): Promise<PrintJob | null> {
    await this.db.prepare(`UPDATE print_jobs SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findJobById(id, tenantId);
  }

  async createStock(input: CreatePrintStockInput): Promise<PrintStock> {
    if (!Number.isInteger(input.unitCostKobo) || input.unitCostKobo <= 0) throw new Error('[print-shop] unitCostKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO print_stock (id, workspace_id, tenant_id, paper_type, gsm, sheet_size, quantity_in_stock, unit_cost_kobo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.paperType, input.gsm ?? null, input.sheetSize ?? null, input.quantityInStock ?? 0, input.unitCostKobo).run();
    const s = await this.findStockById(id, input.tenantId); if (!s) throw new Error('[print-shop] stock create failed'); return s;
  }

  async findStockById(id: string, tenantId: string): Promise<PrintStock | null> {
    const row = await this.db.prepare(`SELECT ${STOCK_COLS} FROM print_stock WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToStock(row) : null;
  }

  async listStock(workspaceId: string, tenantId: string): Promise<PrintStock[]> {
    const { results } = await this.db.prepare(`SELECT ${STOCK_COLS} FROM print_stock WHERE workspace_id = ? AND tenant_id = ? ORDER BY paper_type ASC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToStock);
  }
}
