import type { PropertyDeveloperProfile, CreatePropertyDeveloperInput, UpdatePropertyDeveloperInput, PropertyDeveloperFSMState, PropertyEstate, CreatePropertyEstateInput, PropertyUnit, CreatePropertyUnitInput, UnitStatus, PropertyAllocation, CreatePropertyAllocationInput, AllocationStatus, InstalmentEntry } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, surcon_number, toprec_number, cac_rc, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): PropertyDeveloperProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, companyName: r['company_name'] as string, surconNumber: r['surcon_number'] as string | null, toprecNumber: r['toprec_number'] as string | null, cacRc: r['cac_rc'] as string | null, status: r['status'] as PropertyDeveloperFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const ESTATE_COLS = 'id, workspace_id, tenant_id, estate_name, location, state, lga, land_title_type, permit_number, total_units, status, created_at, updated_at';
function rowToEstate(r: Record<string, unknown>): PropertyEstate {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, estateName: r['estate_name'] as string, location: r['location'] as string | null, state: r['state'] as string | null, lga: r['lga'] as string | null, landTitleType: r['land_title_type'] as PropertyEstate['landTitleType'], permitNumber: r['permit_number'] as string | null, totalUnits: r['total_units'] as number, status: r['status'] as PropertyEstate['status'], createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const UNIT_COLS = 'id, estate_id, workspace_id, tenant_id, unit_type, unit_number, floor_area_sqm, price_kobo, status, created_at, updated_at';
function rowToUnit(r: Record<string, unknown>): PropertyUnit {
  return { id: r['id'] as string, estateId: r['estate_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, unitType: r['unit_type'] as PropertyUnit['unitType'], unitNumber: r['unit_number'] as string, floorAreaSqm: r['floor_area_sqm'] as number, priceKobo: r['price_kobo'] as number, status: r['status'] as UnitStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const ALLOC_COLS = 'id, unit_id, workspace_id, tenant_id, buyer_phone, buyer_name, total_price_kobo, deposit_kobo, instalment_plan, status, created_at, updated_at';
function rowToAllocation(r: Record<string, unknown>): PropertyAllocation {
  let plan: InstalmentEntry[] = [];
  try { plan = JSON.parse(r['instalment_plan'] as string) as InstalmentEntry[]; } catch { plan = []; }
  return { id: r['id'] as string, unitId: r['unit_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, buyerPhone: r['buyer_phone'] as string, buyerName: r['buyer_name'] as string, totalPriceKobo: r['total_price_kobo'] as number, depositKobo: r['deposit_kobo'] as number, instalmentPlan: plan, status: r['status'] as AllocationStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class PropertyDeveloperRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreatePropertyDeveloperInput): Promise<PropertyDeveloperProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO property_developer_profiles (id, workspace_id, tenant_id, company_name, surcon_number, toprec_number, cac_rc, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.surconNumber ?? null, input.toprecNumber ?? null, input.cacRc ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[property-developer] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<PropertyDeveloperProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM property_developer_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<PropertyDeveloperProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM property_developer_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdatePropertyDeveloperInput): Promise<PropertyDeveloperProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); b.push(input.companyName); }
    if ('surconNumber' in input) { sets.push('surcon_number = ?'); b.push(input.surconNumber ?? null); }
    if ('toprecNumber' in input) { sets.push('toprec_number = ?'); b.push(input.toprecNumber ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc = ?'); b.push(input.cacRc ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE property_developer_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: PropertyDeveloperFSMState): Promise<PropertyDeveloperProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createEstate(input: CreatePropertyEstateInput): Promise<PropertyEstate> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO property_estates (id, workspace_id, tenant_id, estate_name, location, state, lga, land_title_type, permit_number, total_units, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.estateName, input.location ?? null, input.state ?? null, input.lga ?? null, input.landTitleType ?? null, input.permitNumber ?? null, input.totalUnits ?? 0).run();
    const e = await this.findEstateById(id, input.tenantId); if (!e) throw new Error('[property-developer] estate create failed'); return e;
  }

  async findEstateById(id: string, tenantId: string): Promise<PropertyEstate | null> {
    const row = await this.db.prepare(`SELECT ${ESTATE_COLS} FROM property_estates WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToEstate(row) : null;
  }

  async listEstates(workspaceId: string, tenantId: string): Promise<PropertyEstate[]> {
    const { results } = await this.db.prepare(`SELECT ${ESTATE_COLS} FROM property_estates WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToEstate);
  }

  async createUnit(input: CreatePropertyUnitInput): Promise<PropertyUnit> {
    if (!Number.isInteger(input.priceKobo) || input.priceKobo <= 0) throw new Error('[property-developer] priceKobo must be positive integer (P9)');
    if (!Number.isInteger(input.floorAreaSqm) || input.floorAreaSqm <= 0) throw new Error('[property-developer] floorAreaSqm must be positive integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO property_units (id, estate_id, workspace_id, tenant_id, unit_type, unit_number, floor_area_sqm, price_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', unixepoch(), unixepoch())`).bind(id, input.estateId, input.workspaceId, input.tenantId, input.unitType, input.unitNumber, input.floorAreaSqm, input.priceKobo).run();
    const u = await this.findUnitById(id, input.tenantId); if (!u) throw new Error('[property-developer] unit create failed'); return u;
  }

  async findUnitById(id: string, tenantId: string): Promise<PropertyUnit | null> {
    const row = await this.db.prepare(`SELECT ${UNIT_COLS} FROM property_units WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToUnit(row) : null;
  }

  async listUnits(estateId: string, tenantId: string): Promise<PropertyUnit[]> {
    const { results } = await this.db.prepare(`SELECT ${UNIT_COLS} FROM property_units WHERE estate_id = ? AND tenant_id = ? ORDER BY unit_number ASC`).bind(estateId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToUnit);
  }

  async updateUnitStatus(id: string, tenantId: string, status: UnitStatus): Promise<PropertyUnit | null> {
    await this.db.prepare(`UPDATE property_units SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findUnitById(id, tenantId);
  }

  async createAllocation(input: CreatePropertyAllocationInput): Promise<PropertyAllocation> {
    if (!Number.isInteger(input.totalPriceKobo) || input.totalPriceKobo <= 0) throw new Error('[property-developer] totalPriceKobo must be positive integer (P9)');
    if (!Number.isInteger(input.depositKobo) || input.depositKobo < 0) throw new Error('[property-developer] depositKobo must be non-negative integer (P9)');
    const plan = input.instalmentPlan ?? [];
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO property_allocations (id, unit_id, workspace_id, tenant_id, buyer_phone, buyer_name, total_price_kobo, deposit_kobo, instalment_plan, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', unixepoch(), unixepoch())`).bind(id, input.unitId, input.workspaceId, input.tenantId, input.buyerPhone, input.buyerName, input.totalPriceKobo, input.depositKobo, JSON.stringify(plan)).run();
    const a = await this.findAllocationById(id, input.tenantId); if (!a) throw new Error('[property-developer] allocation create failed'); return a;
  }

  async findAllocationById(id: string, tenantId: string): Promise<PropertyAllocation | null> {
    const row = await this.db.prepare(`SELECT ${ALLOC_COLS} FROM property_allocations WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToAllocation(row) : null;
  }

  async listAllocations(workspaceId: string, tenantId: string): Promise<PropertyAllocation[]> {
    const { results } = await this.db.prepare(`SELECT ${ALLOC_COLS} FROM property_allocations WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToAllocation);
  }

  async updateAllocationStatus(id: string, tenantId: string, status: AllocationStatus): Promise<PropertyAllocation | null> {
    await this.db.prepare(`UPDATE property_allocations SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findAllocationById(id, tenantId);
  }
}
