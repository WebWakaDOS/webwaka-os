import type { ConstructionProfile, CreateConstructionInput, UpdateConstructionInput, ConstructionFSMState, ConstructionProject, CreateConstructionProjectInput, ConstructionMilestone, CreateMilestoneInput, MilestoneStatus, ConstructionMaterial, CreateMaterialInput } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, coren_number, corbon_number, bpp_registration, bpp_category, cac_number, status, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): ConstructionProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, companyName: r['company_name'] as string, corenNumber: r['coren_number'] as string | null, corbonNumber: r['corbon_number'] as string | null, bppRegistration: r['bpp_registration'] as string | null, bppCategory: r['bpp_category'] as ConstructionProfile['bppCategory'], cacNumber: r['cac_number'] as string | null, status: r['status'] as ConstructionFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const PROJECT_COLS = 'id, workspace_id, tenant_id, project_name, client_name, client_phone, location, contract_value_kobo, start_date, expected_end_date, status, created_at, updated_at';

function rowToProject(r: Record<string, unknown>): ConstructionProject {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, projectName: r['project_name'] as string, clientName: r['client_name'] as string, clientPhone: r['client_phone'] as string, location: r['location'] as string, contractValueKobo: r['contract_value_kobo'] as number, startDate: r['start_date'] as number | null, expectedEndDate: r['expected_end_date'] as number | null, status: r['status'] as ConstructionProject['status'], createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const MILESTONE_COLS = 'id, project_id, workspace_id, tenant_id, milestone_name, amount_kobo, due_date, paid_date, status, created_at, updated_at';

function rowToMilestone(r: Record<string, unknown>): ConstructionMilestone {
  return { id: r['id'] as string, projectId: r['project_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, milestoneName: r['milestone_name'] as string, amountKobo: r['amount_kobo'] as number, dueDate: r['due_date'] as number | null, paidDate: r['paid_date'] as number | null, status: r['status'] as MilestoneStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const MATERIAL_COLS = 'id, project_id, workspace_id, tenant_id, material_name, quantity, unit_cost_kobo, supplier, procurement_date, created_at, updated_at';

function rowToMaterial(r: Record<string, unknown>): ConstructionMaterial {
  return { id: r['id'] as string, projectId: r['project_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, materialName: r['material_name'] as string, quantity: r['quantity'] as number, unitCostKobo: r['unit_cost_kobo'] as number, supplier: r['supplier'] as string | null, procurementDate: r['procurement_date'] as number | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class ConstructionRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateConstructionInput): Promise<ConstructionProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO construction_profiles (id, workspace_id, tenant_id, company_name, coren_number, corbon_number, bpp_registration, bpp_category, cac_number, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.corenNumber ?? null, input.corbonNumber ?? null, input.bppRegistration ?? null, input.bppCategory ?? null, input.cacNumber ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[construction] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<ConstructionProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM construction_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<ConstructionProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM construction_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateConstructionInput): Promise<ConstructionProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); b.push(input.companyName); }
    if ('corenNumber' in input) { sets.push('coren_number = ?'); b.push(input.corenNumber ?? null); }
    if ('corbonNumber' in input) { sets.push('corbon_number = ?'); b.push(input.corbonNumber ?? null); }
    if ('bppRegistration' in input) { sets.push('bpp_registration = ?'); b.push(input.bppRegistration ?? null); }
    if ('bppCategory' in input) { sets.push('bpp_category = ?'); b.push(input.bppCategory ?? null); }
    if ('cacNumber' in input) { sets.push('cac_number = ?'); b.push(input.cacNumber ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE construction_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: ConstructionFSMState): Promise<ConstructionProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createProject(input: CreateConstructionProjectInput): Promise<ConstructionProject> {
    if (!Number.isInteger(input.contractValueKobo) || input.contractValueKobo <= 0) throw new Error('[construction] contractValueKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO construction_projects (id, workspace_id, tenant_id, project_name, client_name, client_phone, location, contract_value_kobo, start_date, expected_end_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bid', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.projectName, input.clientName, input.clientPhone, input.location, input.contractValueKobo, input.startDate ?? null, input.expectedEndDate ?? null).run();
    const p = await this.findProjectById(id, input.tenantId); if (!p) throw new Error('[construction] project create failed'); return p;
  }

  async findProjectById(id: string, tenantId: string): Promise<ConstructionProject | null> {
    const row = await this.db.prepare(`SELECT ${PROJECT_COLS} FROM construction_projects WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProject(row) : null;
  }

  async listProjects(workspaceId: string, tenantId: string): Promise<ConstructionProject[]> {
    const { results } = await this.db.prepare(`SELECT ${PROJECT_COLS} FROM construction_projects WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToProject);
  }

  async updateProjectStatus(id: string, tenantId: string, status: ConstructionProject['status']): Promise<ConstructionProject | null> {
    await this.db.prepare(`UPDATE construction_projects SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findProjectById(id, tenantId);
  }

  async createMilestone(input: CreateMilestoneInput): Promise<ConstructionMilestone> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) throw new Error('[construction] amountKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO construction_milestones (id, project_id, workspace_id, tenant_id, milestone_name, amount_kobo, due_date, paid_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending', unixepoch(), unixepoch())`).bind(id, input.projectId, input.workspaceId, input.tenantId, input.milestoneName, input.amountKobo, input.dueDate ?? null).run();
    const m = await this.findMilestoneById(id, input.tenantId); if (!m) throw new Error('[construction] milestone create failed'); return m;
  }

  async findMilestoneById(id: string, tenantId: string): Promise<ConstructionMilestone | null> {
    const row = await this.db.prepare(`SELECT ${MILESTONE_COLS} FROM construction_milestones WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToMilestone(row) : null;
  }

  async listMilestones(projectId: string, tenantId: string): Promise<ConstructionMilestone[]> {
    const { results } = await this.db.prepare(`SELECT ${MILESTONE_COLS} FROM construction_milestones WHERE project_id = ? AND tenant_id = ? ORDER BY due_date ASC`).bind(projectId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToMilestone);
  }

  async updateMilestoneStatus(id: string, tenantId: string, status: MilestoneStatus, paidDate?: number): Promise<ConstructionMilestone | null> {
    await this.db.prepare(`UPDATE construction_milestones SET status = ?, paid_date = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, status === 'paid' ? (paidDate ?? Math.floor(Date.now() / 1000)) : null, id, tenantId).run();
    return this.findMilestoneById(id, tenantId);
  }

  async createMaterial(input: CreateMaterialInput): Promise<ConstructionMaterial> {
    if (!Number.isInteger(input.unitCostKobo) || input.unitCostKobo <= 0) throw new Error('[construction] unitCostKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO construction_materials (id, project_id, workspace_id, tenant_id, material_name, quantity, unit_cost_kobo, supplier, procurement_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.projectId, input.workspaceId, input.tenantId, input.materialName, input.quantity ?? 1, input.unitCostKobo, input.supplier ?? null, input.procurementDate ?? null).run();
    const m = await this.findMaterialById(id, input.tenantId); if (!m) throw new Error('[construction] material create failed'); return m;
  }

  async findMaterialById(id: string, tenantId: string): Promise<ConstructionMaterial | null> {
    const row = await this.db.prepare(`SELECT ${MATERIAL_COLS} FROM construction_materials WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToMaterial(row) : null;
  }

  async listMaterials(projectId: string, tenantId: string): Promise<ConstructionMaterial[]> {
    const { results } = await this.db.prepare(`SELECT ${MATERIAL_COLS} FROM construction_materials WHERE project_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(projectId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToMaterial);
  }
}
