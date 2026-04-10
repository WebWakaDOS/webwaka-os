/**
 * Cleaning Service D1 repository.
 * M9 Commerce P2 — Task V-COMM-EXT-A6
 * Platform Invariants: T3, P9
 * Migration: 0062_vertical_cleaning_service.sql
 */

import type {
  CleaningServiceProfile, CleaningServiceFSMState,
  CreateCleaningServiceInput, UpdateCleaningServiceInput,
  CleaningJob, JobType, JobFrequency, CleaningJobStatus, CreateCleaningJobInput,
  CleaningSupply, CreateCleaningSupplyInput,
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
  id: string; workspace_id: string; tenant_id: string; company_name: string;
  cac_number: string | null; env_agency_permit: string | null; service_types: string;
  status: string; created_at: number; updated_at: number;
}
interface JobRow {
  id: string; workspace_id: string; tenant_id: string; client_phone: string;
  address: string; job_type: string; frequency: string | null; price_kobo: number;
  assigned_staff_id: string | null; status: string; scheduled_at: number | null;
  created_at: number; updated_at: number;
}
interface SupplyRow {
  id: string; workspace_id: string; tenant_id: string; supply_name: string;
  unit: string; quantity_in_stock_x1000: number; unit_cost_kobo: number; created_at: number;
}

const r2p = (r: ProfileRow): CleaningServiceProfile => ({
  id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id,
  companyName: r.company_name, cacNumber: r.cac_number, envAgencyPermit: r.env_agency_permit,
  serviceTypes: r.service_types, status: r.status as CleaningServiceFSMState,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const r2job = (r: JobRow): CleaningJob => ({
  id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id,
  clientPhone: r.client_phone, address: r.address, jobType: r.job_type as JobType,
  frequency: r.frequency as JobFrequency | null, priceKobo: r.price_kobo,
  assignedStaffId: r.assigned_staff_id, status: r.status as CleaningJobStatus,
  scheduledAt: r.scheduled_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
const r2sup = (r: SupplyRow): CleaningSupply => ({
  id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id,
  supplyName: r.supply_name, unit: r.unit, quantityInStockX1000: r.quantity_in_stock_x1000,
  unitCostKobo: r.unit_cost_kobo, createdAt: r.created_at,
});

export class CleaningServiceRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateCleaningServiceInput): Promise<CleaningServiceProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(
      `INSERT INTO cleaning_service_profiles (id, workspace_id, tenant_id, company_name, cac_number, env_agency_permit, service_types, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`,
    ).bind(id, input.workspaceId, input.tenantId, input.companyName,
           input.cacNumber ?? null, input.envAgencyPermit ?? null,
           input.serviceTypes ?? '[]').run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[cleaning-service] Failed to create profile');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<CleaningServiceProfile | null> {
    const row = await this.db.prepare(`SELECT * FROM cleaning_service_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<ProfileRow>();
    return row ? r2p(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateCleaningServiceInput): Promise<CleaningServiceProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); vals.push(input.companyName); }
    if ('cacNumber' in input) { sets.push('cac_number = ?'); vals.push(input.cacNumber ?? null); }
    if ('envAgencyPermit' in input) { sets.push('env_agency_permit = ?'); vals.push(input.envAgencyPermit ?? null); }
    if (input.serviceTypes !== undefined) { sets.push('service_types = ?'); vals.push(input.serviceTypes); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    vals.push(id, tenantId);
    await this.db.prepare(`UPDATE cleaning_service_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, toStatus: CleaningServiceFSMState): Promise<CleaningServiceProfile | null> {
    return this.updateProfile(id, tenantId, { status: toStatus });
  }

  async createJob(input: CreateCleaningJobInput): Promise<CleaningJob> {
    const id = input.id ?? crypto.randomUUID();
    if (!Number.isInteger(input.priceKobo) || input.priceKobo < 0) throw new Error('[P9] price_kobo must be non-negative integer');
    await this.db.prepare(
      `INSERT INTO cleaning_jobs (id, workspace_id, tenant_id, client_phone, address, job_type, frequency, price_kobo, assigned_staff_id, status, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, unixepoch(), unixepoch())`,
    ).bind(id, input.workspaceId, input.tenantId, input.clientPhone, input.address,
           input.jobType, input.frequency ?? null, input.priceKobo,
           input.assignedStaffId ?? null, input.scheduledAt ?? null).run();
    const j = await this.findJobById(id, input.tenantId);
    if (!j) throw new Error('[cleaning-service] Failed to create job');
    return j;
  }

  async findJobById(id: string, tenantId: string): Promise<CleaningJob | null> {
    const row = await this.db.prepare(`SELECT * FROM cleaning_jobs WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<JobRow>();
    return row ? r2job(row) : null;
  }

  async listJobs(workspaceId: string, tenantId: string, status?: CleaningJobStatus): Promise<CleaningJob[]> {
    let sql = `SELECT * FROM cleaning_jobs WHERE workspace_id = ? AND tenant_id = ?`;
    const binds: unknown[] = [workspaceId, tenantId];
    if (status) { sql += ` AND status = ?`; binds.push(status); }
    sql += ` ORDER BY created_at DESC`;
    const { results } = await this.db.prepare(sql).bind(...binds).all<JobRow>();
    return (results ?? []).map(r2job);
  }

  async updateJobStatus(id: string, tenantId: string, status: CleaningJobStatus): Promise<CleaningJob | null> {
    await this.db.prepare(`UPDATE cleaning_jobs SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findJobById(id, tenantId);
  }

  async createSupply(input: CreateCleaningSupplyInput): Promise<CleaningSupply> {
    const id = input.id ?? crypto.randomUUID();
    if (!Number.isInteger(input.unitCostKobo) || input.unitCostKobo < 0) throw new Error('[P9] unit_cost_kobo must be non-negative integer');
    await this.db.prepare(
      `INSERT INTO cleaning_supplies (id, workspace_id, tenant_id, supply_name, unit, quantity_in_stock_x1000, unit_cost_kobo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    ).bind(id, input.workspaceId, input.tenantId, input.supplyName, input.unit,
           input.quantityInStockX1000, input.unitCostKobo).run();
    const s = await this.findSupplyById(id, input.tenantId);
    if (!s) throw new Error('[cleaning-service] Failed to create supply');
    return s;
  }

  async findSupplyById(id: string, tenantId: string): Promise<CleaningSupply | null> {
    const row = await this.db.prepare(`SELECT * FROM cleaning_supplies WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<SupplyRow>();
    return row ? r2sup(row) : null;
  }

  async listSupplies(workspaceId: string, tenantId: string): Promise<CleaningSupply[]> {
    const { results } = await this.db.prepare(`SELECT * FROM cleaning_supplies WHERE workspace_id = ? AND tenant_id = ? ORDER BY supply_name ASC`).bind(workspaceId, tenantId).all<SupplyRow>();
    return (results ?? []).map(r2sup);
  }
}
