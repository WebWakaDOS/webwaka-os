import type { SecurityCompanyProfile, CreateSecurityCompanyInput, UpdateSecurityCompanyInput, SecurityCompanyFSMState, SecurityGuard, CreateSecurityGuardInput, GuardStatus, SecuritySite, CreateSecuritySiteInput, SecurityIncident, CreateSecurityIncidentInput } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, psc_licence, pscai_number, cac_rc, guard_count, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): SecurityCompanyProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, companyName: r['company_name'] as string, pscLicence: r['psc_licence'] as string | null, pscaiNumber: r['pscai_number'] as string | null, cacRc: r['cac_rc'] as string | null, guardCount: r['guard_count'] as number, status: r['status'] as SecurityCompanyFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const GUARD_COLS = 'id, workspace_id, tenant_id, guard_name, id_number, training_cert, deployment_site_id, monthly_salary_kobo, status, created_at, updated_at';
function rowToGuard(r: Record<string, unknown>): SecurityGuard {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, guardName: r['guard_name'] as string, idNumber: r['id_number'] as string | null, trainingCert: r['training_cert'] as string | null, deploymentSiteId: r['deployment_site_id'] as string | null, monthlySalaryKobo: r['monthly_salary_kobo'] as number, status: r['status'] as GuardStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const SITE_COLS = 'id, workspace_id, tenant_id, site_name, client_phone, address, state, guard_count_required, monthly_fee_kobo, contract_start, contract_end, created_at, updated_at';
function rowToSite(r: Record<string, unknown>): SecuritySite {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, siteName: r['site_name'] as string, clientPhone: r['client_phone'] as string | null, address: r['address'] as string | null, state: r['state'] as string | null, guardCountRequired: r['guard_count_required'] as number, monthlyFeeKobo: r['monthly_fee_kobo'] as number, contractStart: r['contract_start'] as number | null, contractEnd: r['contract_end'] as number | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const INCIDENT_COLS = 'id, site_id, workspace_id, tenant_id, report_date, incident_type, description, guard_id, action_taken, created_at, updated_at';
function rowToIncident(r: Record<string, unknown>): SecurityIncident {
  return { id: r['id'] as string, siteId: r['site_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, reportDate: r['report_date'] as number, incidentType: r['incident_type'] as string, description: r['description'] as string | null, guardId: r['guard_id'] as string | null, actionTaken: r['action_taken'] as string | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class SecurityCompanyRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateSecurityCompanyInput): Promise<SecurityCompanyProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO security_company_profiles (id, workspace_id, tenant_id, company_name, psc_licence, pscai_number, cac_rc, guard_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.pscLicence ?? null, input.pscaiNumber ?? null, input.cacRc ?? null, input.guardCount ?? 0).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[security-company] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<SecurityCompanyProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM security_company_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<SecurityCompanyProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM security_company_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateSecurityCompanyInput): Promise<SecurityCompanyProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); b.push(input.companyName); }
    if ('pscLicence' in input) { sets.push('psc_licence = ?'); b.push(input.pscLicence ?? null); }
    if ('pscaiNumber' in input) { sets.push('pscai_number = ?'); b.push(input.pscaiNumber ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc = ?'); b.push(input.cacRc ?? null); }
    if (input.guardCount !== undefined) { sets.push('guard_count = ?'); b.push(input.guardCount); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE security_company_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: SecurityCompanyFSMState): Promise<SecurityCompanyProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createGuard(input: CreateSecurityGuardInput): Promise<SecurityGuard> {
    if (!Number.isInteger(input.monthlySalaryKobo) || input.monthlySalaryKobo <= 0) throw new Error('[security-company] monthlySalaryKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO security_guards (id, workspace_id, tenant_id, guard_name, id_number, training_cert, deployment_site_id, monthly_salary_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.guardName, input.idNumber ?? null, input.trainingCert ?? null, input.deploymentSiteId ?? null, input.monthlySalaryKobo).run();
    const g = await this.findGuardById(id, input.tenantId); if (!g) throw new Error('[security-company] guard create failed'); return g;
  }

  async findGuardById(id: string, tenantId: string): Promise<SecurityGuard | null> {
    const row = await this.db.prepare(`SELECT ${GUARD_COLS} FROM security_guards WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToGuard(row) : null;
  }

  async listGuards(workspaceId: string, tenantId: string): Promise<SecurityGuard[]> {
    const { results } = await this.db.prepare(`SELECT ${GUARD_COLS} FROM security_guards WHERE workspace_id = ? AND tenant_id = ? ORDER BY guard_name ASC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToGuard);
  }

  async updateGuardStatus(id: string, tenantId: string, status: GuardStatus): Promise<SecurityGuard | null> {
    await this.db.prepare(`UPDATE security_guards SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findGuardById(id, tenantId);
  }

  async createSite(input: CreateSecuritySiteInput): Promise<SecuritySite> {
    if (!Number.isInteger(input.monthlyFeeKobo) || input.monthlyFeeKobo <= 0) throw new Error('[security-company] monthlyFeeKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO security_sites (id, workspace_id, tenant_id, site_name, client_phone, address, state, guard_count_required, monthly_fee_kobo, contract_start, contract_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.siteName, input.clientPhone ?? null, input.address ?? null, input.state ?? null, input.guardCountRequired ?? 1, input.monthlyFeeKobo, input.contractStart ?? null, input.contractEnd ?? null).run();
    const s = await this.findSiteById(id, input.tenantId); if (!s) throw new Error('[security-company] site create failed'); return s;
  }

  async findSiteById(id: string, tenantId: string): Promise<SecuritySite | null> {
    const row = await this.db.prepare(`SELECT ${SITE_COLS} FROM security_sites WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToSite(row) : null;
  }

  async listSites(workspaceId: string, tenantId: string): Promise<SecuritySite[]> {
    const { results } = await this.db.prepare(`SELECT ${SITE_COLS} FROM security_sites WHERE workspace_id = ? AND tenant_id = ? ORDER BY site_name ASC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToSite);
  }

  async createIncident(input: CreateSecurityIncidentInput): Promise<SecurityIncident> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO security_incidents (id, site_id, workspace_id, tenant_id, report_date, incident_type, description, guard_id, action_taken, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.siteId, input.workspaceId, input.tenantId, input.reportDate, input.incidentType, input.description ?? null, input.guardId ?? null, input.actionTaken ?? null).run();
    const i = await this.findIncidentById(id, input.tenantId); if (!i) throw new Error('[security-company] incident create failed'); return i;
  }

  async findIncidentById(id: string, tenantId: string): Promise<SecurityIncident | null> {
    const row = await this.db.prepare(`SELECT ${INCIDENT_COLS} FROM security_incidents WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToIncident(row) : null;
  }

  async listIncidents(siteId: string, tenantId: string): Promise<SecurityIncident[]> {
    const { results } = await this.db.prepare(`SELECT ${INCIDENT_COLS} FROM security_incidents WHERE site_id = ? AND tenant_id = ? ORDER BY report_date DESC`).bind(siteId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToIncident);
  }
}
