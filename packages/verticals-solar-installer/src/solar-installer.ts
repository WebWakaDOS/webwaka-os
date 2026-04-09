import type { SolarInstallerProfile, CreateSolarInstallerInput, UpdateSolarInstallerInput, SolarInstallerFSMState, SolarProject, CreateSolarProjectInput, SolarProjectStatus, SolarComponent, CreateSolarComponentInput } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, nerc_registration, nemsa_cert, cac_rc, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): SolarInstallerProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, companyName: r['company_name'] as string, nercRegistration: r['nerc_registration'] as string | null, nemsaCert: r['nemsa_cert'] as string | null, cacRc: r['cac_rc'] as string | null, status: r['status'] as SolarInstallerFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const PROJECT_COLS = 'id, workspace_id, tenant_id, client_phone, address, system_size_watts, panel_count, battery_capacity_wh, inverter_kva, total_cost_kobo, status, created_at, updated_at';
function rowToProject(r: Record<string, unknown>): SolarProject {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, clientPhone: r['client_phone'] as string, address: r['address'] as string | null, systemSizeWatts: r['system_size_watts'] as number, panelCount: r['panel_count'] as number, batteryCapacityWh: r['battery_capacity_wh'] as number, inverterKva: r['inverter_kva'] as number, totalCostKobo: r['total_cost_kobo'] as number, status: r['status'] as SolarProjectStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const COMPONENT_COLS = 'id, project_id, workspace_id, tenant_id, component_type, brand, quantity, unit_cost_kobo, supplier, created_at, updated_at';
function rowToComponent(r: Record<string, unknown>): SolarComponent {
  return { id: r['id'] as string, projectId: r['project_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, componentType: r['component_type'] as SolarComponent['componentType'], brand: r['brand'] as string | null, quantity: r['quantity'] as number, unitCostKobo: r['unit_cost_kobo'] as number, supplier: r['supplier'] as string | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class SolarInstallerRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateSolarInstallerInput): Promise<SolarInstallerProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO solar_installer_profiles (id, workspace_id, tenant_id, company_name, nerc_registration, nemsa_cert, cac_rc, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.nercRegistration ?? null, input.nemsaCert ?? null, input.cacRc ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[solar-installer] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<SolarInstallerProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM solar_installer_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<SolarInstallerProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM solar_installer_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateSolarInstallerInput): Promise<SolarInstallerProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); b.push(input.companyName); }
    if ('nercRegistration' in input) { sets.push('nerc_registration = ?'); b.push(input.nercRegistration ?? null); }
    if ('nemsaCert' in input) { sets.push('nemsa_cert = ?'); b.push(input.nemsaCert ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc = ?'); b.push(input.cacRc ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE solar_installer_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: SolarInstallerFSMState): Promise<SolarInstallerProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createProject(input: CreateSolarProjectInput): Promise<SolarProject> {
    if (!Number.isInteger(input.totalCostKobo) || input.totalCostKobo <= 0) throw new Error('[solar-installer] totalCostKobo must be positive integer (P9)');
    if (!Number.isInteger(input.systemSizeWatts) || input.systemSizeWatts <= 0) throw new Error('[solar-installer] systemSizeWatts must be positive integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO solar_projects (id, workspace_id, tenant_id, client_phone, address, system_size_watts, panel_count, battery_capacity_wh, inverter_kva, total_cost_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'survey', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clientPhone, input.address ?? null, input.systemSizeWatts, input.panelCount ?? 0, input.batteryCapacityWh ?? 0, input.inverterKva ?? 0, input.totalCostKobo).run();
    const p = await this.findProjectById(id, input.tenantId); if (!p) throw new Error('[solar-installer] project create failed'); return p;
  }

  async findProjectById(id: string, tenantId: string): Promise<SolarProject | null> {
    const row = await this.db.prepare(`SELECT ${PROJECT_COLS} FROM solar_projects WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProject(row) : null;
  }

  async listProjects(workspaceId: string, tenantId: string): Promise<SolarProject[]> {
    const { results } = await this.db.prepare(`SELECT ${PROJECT_COLS} FROM solar_projects WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToProject);
  }

  async updateProjectStatus(id: string, tenantId: string, status: SolarProjectStatus): Promise<SolarProject | null> {
    await this.db.prepare(`UPDATE solar_projects SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findProjectById(id, tenantId);
  }

  async createComponent(input: CreateSolarComponentInput): Promise<SolarComponent> {
    if (!Number.isInteger(input.unitCostKobo) || input.unitCostKobo <= 0) throw new Error('[solar-installer] unitCostKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO solar_components (id, project_id, workspace_id, tenant_id, component_type, brand, quantity, unit_cost_kobo, supplier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.projectId, input.workspaceId, input.tenantId, input.componentType, input.brand ?? null, input.quantity ?? 1, input.unitCostKobo, input.supplier ?? null).run();
    const c = await this.findComponentById(id, input.tenantId); if (!c) throw new Error('[solar-installer] component create failed'); return c;
  }

  async findComponentById(id: string, tenantId: string): Promise<SolarComponent | null> {
    const row = await this.db.prepare(`SELECT ${COMPONENT_COLS} FROM solar_components WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToComponent(row) : null;
  }

  async listComponents(projectId: string, tenantId: string): Promise<SolarComponent[]> {
    const { results } = await this.db.prepare(`SELECT ${COMPONENT_COLS} FROM solar_components WHERE project_id = ? AND tenant_id = ? ORDER BY component_type`).bind(projectId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToComponent);
  }
}
