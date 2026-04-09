import type {
  ContainerDepotProfile, CreateContainerDepotInput, UpdateContainerDepotInput,
  ContainerDepotFSMState, ContainerRecord, CreateContainerRecordInput, ContainerStatus,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, ncs_licence, npa_licence, cac_rc, depot_location, status, created_at, updated_at';
const CONTAINER_COLS = 'id, profile_id, tenant_id, container_number, container_type, weight_kg, client_phone, operation_type, daily_storage_rate_kobo, days_in_depot, storage_charge_kobo, ncs_release_number, status, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): ContainerDepotProfile {
  return {
    id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string,
    companyName: r['company_name'] as string, ncsLicence: r['ncs_licence'] as string | null,
    npaLicence: r['npa_licence'] as string | null, cacRc: r['cac_rc'] as string | null,
    depotLocation: r['depot_location'] as string | null,
    status: r['status'] as ContainerDepotFSMState,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToContainer(r: Record<string, unknown>): ContainerRecord {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    containerNumber: r['container_number'] as string,
    containerType: r['container_type'] as ContainerRecord['containerType'],
    weightKg: r['weight_kg'] as number, clientPhone: r['client_phone'] as string | null,
    operationType: r['operation_type'] as ContainerRecord['operationType'],
    dailyStorageRateKobo: r['daily_storage_rate_kobo'] as number,
    daysInDepot: r['days_in_depot'] as number,
    storageChargeKobo: r['storage_charge_kobo'] as number,
    ncsReleaseNumber: r['ncs_release_number'] as string | null,
    status: r['status'] as ContainerStatus,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

export class ContainerDepotRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateContainerDepotInput): Promise<ContainerDepotProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO container_depot_profiles (id, workspace_id, tenant_id, company_name, ncs_licence, npa_licence, cac_rc, depot_location, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.ncsLicence ?? null, input.npaLicence ?? null, input.cacRc ?? null, input.depotLocation ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[container-depot] profile create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<ContainerDepotProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM container_depot_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<ContainerDepotProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM container_depot_profiles WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateContainerDepotInput): Promise<ContainerDepotProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); vals.push(input.companyName); }
    if (input.ncsLicence !== undefined) { sets.push('ncs_licence = ?'); vals.push(input.ncsLicence); }
    if (input.npaLicence !== undefined) { sets.push('npa_licence = ?'); vals.push(input.npaLicence); }
    if (input.cacRc !== undefined) { sets.push('cac_rc = ?'); vals.push(input.cacRc); }
    if (input.depotLocation !== undefined) { sets.push('depot_location = ?'); vals.push(input.depotLocation); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    await this.db.prepare(`UPDATE container_depot_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionStatus(id: string, tenantId: string, to: ContainerDepotFSMState): Promise<ContainerDepotProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createContainerRecord(input: CreateContainerRecordInput): Promise<ContainerRecord> {
    if (!Number.isInteger(input.weightKg) || input.weightKg < 0) throw new Error('[container-depot] weightKg must be non-negative integer (P9)');
    if (!Number.isInteger(input.dailyStorageRateKobo) || input.dailyStorageRateKobo < 0) throw new Error('[container-depot] dailyStorageRateKobo must be non-negative integer (P9)');
    const daysInDepot = input.daysInDepot ?? 0;
    if (!Number.isInteger(daysInDepot)) throw new Error('[container-depot] daysInDepot must be integer (P9)');
    const storageChargeKobo = input.dailyStorageRateKobo * daysInDepot;
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO container_records (id, profile_id, tenant_id, container_number, container_type, weight_kg, client_phone, operation_type, daily_storage_rate_kobo, days_in_depot, storage_charge_kobo, ncs_release_number, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.containerNumber, input.containerType ?? '20ft', input.weightKg, input.clientPhone ?? null, input.operationType ?? 'storage', input.dailyStorageRateKobo, daysInDepot, storageChargeKobo, input.ncsReleaseNumber ?? null).run();
    const c = await this.findContainerRecordById(id, input.tenantId);
    if (!c) throw new Error('[container-depot] container record create failed');
    return c;
  }

  async findContainerRecordById(id: string, tenantId: string): Promise<ContainerRecord | null> {
    const row = await this.db.prepare(`SELECT ${CONTAINER_COLS} FROM container_records WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToContainer(row) : null;
  }

  async listContainerRecords(profileId: string, tenantId: string): Promise<ContainerRecord[]> {
    const { results } = await this.db.prepare(`SELECT ${CONTAINER_COLS} FROM container_records WHERE profile_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToContainer);
  }

  async updateContainerStatus(id: string, tenantId: string, status: ContainerStatus, ncsReleaseNumber?: string): Promise<ContainerRecord | null> {
    const sets: string[] = ['status = ?', 'updated_at = unixepoch()']; const vals: unknown[] = [status];
    if (ncsReleaseNumber !== undefined) { sets.push('ncs_release_number = ?'); vals.push(ncsReleaseNumber); }
    await this.db.prepare(`UPDATE container_records SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findContainerRecordById(id, tenantId);
  }
}
