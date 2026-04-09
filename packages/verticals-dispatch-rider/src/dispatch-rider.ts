import type {
  DispatchRiderProfile, CreateDispatchRiderProfileInput, UpdateDispatchRiderProfileInput,
  DispatchRiderFSMState, DispatchRider, CreateDispatchRiderInput,
  DispatchJob, CreateDispatchJobInput, JobStatus,
  RiderEarning, CreateRiderEarningInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, cac_rc, status, created_at, updated_at';
const RIDER_COLS = 'id, profile_id, tenant_id, rider_name, phone, frsc_licence, vio_cert, vehicle_plate, commission_pct, status, created_at, updated_at';
const JOB_COLS = 'id, profile_id, tenant_id, pickup_address, dropoff_address, package_description, fee_kobo, cod_amount_kobo, rider_id, customer_phone, status, created_at, updated_at';
const EARNING_COLS = 'id, rider_id, job_id, tenant_id, gross_fee_kobo, commission_kobo, net_payout_kobo, payout_date, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): DispatchRiderProfile {
  return {
    id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string,
    companyName: r['company_name'] as string, cacRc: r['cac_rc'] as string | null,
    status: r['status'] as DispatchRiderFSMState,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToRider(r: Record<string, unknown>): DispatchRider {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    riderName: r['rider_name'] as string, phone: r['phone'] as string | null,
    frscLicence: r['frsc_licence'] as string | null, vioCert: r['vio_cert'] as string | null,
    vehiclePlate: r['vehicle_plate'] as string | null, commissionPct: r['commission_pct'] as number,
    status: r['status'] as DispatchRider['status'],
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToJob(r: Record<string, unknown>): DispatchJob {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    pickupAddress: r['pickup_address'] as string | null, dropoffAddress: r['dropoff_address'] as string | null,
    packageDescription: r['package_description'] as string | null,
    feeKobo: r['fee_kobo'] as number, codAmountKobo: r['cod_amount_kobo'] as number,
    riderId: r['rider_id'] as string | null, customerPhone: r['customer_phone'] as string | null,
    status: r['status'] as JobStatus,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToEarning(r: Record<string, unknown>): RiderEarning {
  return {
    id: r['id'] as string, riderId: r['rider_id'] as string, jobId: r['job_id'] as string,
    tenantId: r['tenant_id'] as string,
    grossFeeKobo: r['gross_fee_kobo'] as number, commissionKobo: r['commission_kobo'] as number,
    netPayoutKobo: r['net_payout_kobo'] as number, payoutDate: r['payout_date'] as number | null,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

export class DispatchRiderRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateDispatchRiderProfileInput): Promise<DispatchRiderProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO dispatch_rider_profiles (id, workspace_id, tenant_id, company_name, cac_rc, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.cacRc ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[dispatch-rider] profile create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<DispatchRiderProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM dispatch_rider_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<DispatchRiderProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM dispatch_rider_profiles WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateDispatchRiderProfileInput): Promise<DispatchRiderProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); vals.push(input.companyName); }
    if (input.cacRc !== undefined) { sets.push('cac_rc = ?'); vals.push(input.cacRc); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    await this.db.prepare(`UPDATE dispatch_rider_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionStatus(id: string, tenantId: string, to: DispatchRiderFSMState): Promise<DispatchRiderProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createRider(input: CreateDispatchRiderInput): Promise<DispatchRider> {
    const commPct = input.commissionPct ?? 0;
    if (!Number.isInteger(commPct) || commPct < 0 || commPct > 100) throw new Error('[dispatch-rider] commissionPct must be integer 0-100 (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO dispatch_riders (id, profile_id, tenant_id, rider_name, phone, frsc_licence, vio_cert, vehicle_plate, commission_pct, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.riderName, input.phone ?? null, input.frscLicence ?? null, input.vioCert ?? null, input.vehiclePlate ?? null, commPct).run();
    const r = await this.db.prepare(`SELECT ${RIDER_COLS} FROM dispatch_riders WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!r) throw new Error('[dispatch-rider] rider create failed');
    return rowToRider(r);
  }

  async listRiders(profileId: string, tenantId: string): Promise<DispatchRider[]> {
    const { results } = await this.db.prepare(`SELECT ${RIDER_COLS} FROM dispatch_riders WHERE profile_id = ? AND tenant_id = ? ORDER BY rider_name ASC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToRider);
  }

  async createJob(input: CreateDispatchJobInput): Promise<DispatchJob> {
    if (!Number.isInteger(input.feeKobo) || input.feeKobo < 0) throw new Error('[dispatch-rider] feeKobo must be non-negative integer (P9)');
    const codAmountKobo = input.codAmountKobo ?? 0;
    if (!Number.isInteger(codAmountKobo)) throw new Error('[dispatch-rider] codAmountKobo must be integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO dispatch_jobs (id, profile_id, tenant_id, pickup_address, dropoff_address, package_description, fee_kobo, cod_amount_kobo, rider_id, customer_phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'created', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.pickupAddress ?? null, input.dropoffAddress ?? null, input.packageDescription ?? null, input.feeKobo, codAmountKobo, input.customerPhone ?? null).run();
    const j = await this.findJobById(id, input.tenantId);
    if (!j) throw new Error('[dispatch-rider] job create failed');
    return j;
  }

  async findJobById(id: string, tenantId: string): Promise<DispatchJob | null> {
    const row = await this.db.prepare(`SELECT ${JOB_COLS} FROM dispatch_jobs WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToJob(row) : null;
  }

  async listJobs(profileId: string, tenantId: string): Promise<DispatchJob[]> {
    const { results } = await this.db.prepare(`SELECT ${JOB_COLS} FROM dispatch_jobs WHERE profile_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToJob);
  }

  async updateJobStatus(id: string, tenantId: string, status: JobStatus, riderId?: string): Promise<DispatchJob | null> {
    if (riderId !== undefined) {
      await this.db.prepare(`UPDATE dispatch_jobs SET status = ?, rider_id = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, riderId, id, tenantId).run();
    } else {
      await this.db.prepare(`UPDATE dispatch_jobs SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    }
    return this.findJobById(id, tenantId);
  }

  async createRiderEarning(input: CreateRiderEarningInput): Promise<RiderEarning> {
    if (!Number.isInteger(input.grossFeeKobo) || input.grossFeeKobo < 0) throw new Error('[dispatch-rider] grossFeeKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.commissionKobo) || input.commissionKobo < 0) throw new Error('[dispatch-rider] commissionKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.netPayoutKobo) || input.netPayoutKobo < 0) throw new Error('[dispatch-rider] netPayoutKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO rider_earnings (id, rider_id, job_id, tenant_id, gross_fee_kobo, commission_kobo, net_payout_kobo, payout_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.riderId, input.jobId, input.tenantId, input.grossFeeKobo, input.commissionKobo, input.netPayoutKobo, input.payoutDate ?? null).run();
    const e = await this.db.prepare(`SELECT ${EARNING_COLS} FROM rider_earnings WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!e) throw new Error('[dispatch-rider] earning create failed');
    return rowToEarning(e);
  }

  async listRiderEarnings(riderId: string, tenantId: string): Promise<RiderEarning[]> {
    const { results } = await this.db.prepare(`SELECT ${EARNING_COLS} FROM rider_earnings WHERE rider_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(riderId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToEarning);
  }
}
