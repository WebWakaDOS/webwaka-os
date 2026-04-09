/**
 * ElderlyCareRepository — M12
 * T3: all queries scoped to tenantId
 * P9: monthly_rate_kobo, monthly_charge_kobo, paid_kobo, outstanding_kobo are integers
 * P13: resident_ref_id is opaque UUID — no clinical data in D1
 */

import type {
  ElderlyCareProfile, CareResident, CareBilling, CareStaffRota,
  ElderlyCareProfileFSMState,
  CreateElderlyCareInput, UpdateElderlyCareInput,
  CreateCareResidentInput, CreateCareBillingInput, CreateCareStaffRotaInput,
} from './types.js';

interface D1Like {
  prepare(s: string): {
    bind(...v: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; facility_name: string; fmhsw_registration: string | null; state_social_welfare_cert: string | null; cac_rc: string | null; bed_count: number; status: string; created_at: number; updated_at: number; }
interface ResidentRow { id: string; profile_id: string; tenant_id: string; resident_ref_id: string; room_number: string | null; admission_date: number; monthly_rate_kobo: number; payer_ref_id: string | null; payer_type: string; status: string; created_at: number; updated_at: number; }
interface BillingRow { id: string; profile_id: string; tenant_id: string; resident_ref_id: string; billing_period: string; monthly_charge_kobo: number; paid_kobo: number; outstanding_kobo: number; payment_date: number | null; created_at: number; updated_at: number; }
interface RotaRow { id: string; profile_id: string; tenant_id: string; staff_name: string; role: string; shift_start: number; shift_end: number; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): ElderlyCareProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, facilityName: r.facility_name, fmhswRegistration: r.fmhsw_registration, stateSocialWelfareCert: r.state_social_welfare_cert, cacRc: r.cac_rc, bedCount: r.bed_count, status: r.status as ElderlyCareProfileFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToResident(r: ResidentRow): CareResident { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, residentRefId: r.resident_ref_id, roomNumber: r.room_number, admissionDate: r.admission_date, monthlyRateKobo: r.monthly_rate_kobo, payerRefId: r.payer_ref_id, payerType: r.payer_type as CareResident['payerType'], status: r.status as CareResident['status'], createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToBilling(r: BillingRow): CareBilling { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, residentRefId: r.resident_ref_id, billingPeriod: r.billing_period, monthlyChargeKobo: r.monthly_charge_kobo, paidKobo: r.paid_kobo, outstandingKobo: r.outstanding_kobo, paymentDate: r.payment_date, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToRota(r: RotaRow): CareStaffRota { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, staffName: r.staff_name, role: r.role, shiftStart: r.shift_start, shiftEnd: r.shift_end, createdAt: r.created_at, updatedAt: r.updated_at }; }

const PC = 'id,workspace_id,tenant_id,facility_name,fmhsw_registration,state_social_welfare_cert,cac_rc,bed_count,status,created_at,updated_at';
const RC = 'id,profile_id,tenant_id,resident_ref_id,room_number,admission_date,monthly_rate_kobo,payer_ref_id,payer_type,status,created_at,updated_at';
const BC = 'id,profile_id,tenant_id,resident_ref_id,billing_period,monthly_charge_kobo,paid_kobo,outstanding_kobo,payment_date,created_at,updated_at';
const RTC = 'id,profile_id,tenant_id,staff_name,role,shift_start,shift_end,created_at,updated_at';

export class ElderlyCareRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateElderlyCareInput): Promise<ElderlyCareProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO elderly_care_profiles (id,workspace_id,tenant_id,facility_name,fmhsw_registration,state_social_welfare_cert,cac_rc,bed_count,status,created_at,updated_at) VALUES (?,?,?,?,NULL,NULL,NULL,?,'seeded',unixepoch(),unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.facilityName, input.bedCount ?? 0).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[elderly-care] create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<ElderlyCareProfile | null> {
    const r = await this.db.prepare(`SELECT ${PC} FROM elderly_care_profiles WHERE id=? AND tenant_id=?`).bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateElderlyCareInput & { status?: ElderlyCareProfileFSMState }): Promise<ElderlyCareProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.facilityName !== undefined) { sets.push('facility_name=?'); b.push(input.facilityName); }
    if ('fmhswRegistration' in input) { sets.push('fmhsw_registration=?'); b.push(input.fmhswRegistration ?? null); }
    if ('stateSocialWelfareCert' in input) { sets.push('state_social_welfare_cert=?'); b.push(input.stateSocialWelfareCert ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc=?'); b.push(input.cacRc ?? null); }
    if (input.bedCount !== undefined) { sets.push('bed_count=?'); b.push(input.bedCount); }
    if (input.status !== undefined) { sets.push('status=?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at=unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE elderly_care_profiles SET ${sets.join(',')} WHERE id=? AND tenant_id=?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transition(id: string, tenantId: string, to: ElderlyCareProfileFSMState): Promise<ElderlyCareProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createResident(input: CreateCareResidentInput): Promise<CareResident> {
    if (!Number.isInteger(input.monthlyRateKobo) || input.monthlyRateKobo < 0) throw new Error('P9: monthlyRateKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    const ref = input.residentRefId ?? crypto.randomUUID();
    const now = input.admissionDate ?? Math.floor(Date.now() / 1000);
    await this.db.prepare(`INSERT INTO care_residents (id,profile_id,tenant_id,resident_ref_id,room_number,admission_date,monthly_rate_kobo,payer_ref_id,payer_type,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'active',unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, ref, input.roomNumber ?? null, now, input.monthlyRateKobo, input.payerRefId ?? null, input.payerType ?? 'family').run();
    const r = await this.db.prepare(`SELECT ${RC} FROM care_residents WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<ResidentRow>();
    if (!r) throw new Error('[elderly-care] create resident failed');
    return rowToResident(r);
  }

  async listResidents(profileId: string, tenantId: string): Promise<CareResident[]> {
    const { results } = await this.db.prepare(`SELECT ${RC} FROM care_residents WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<ResidentRow>();
    return (results ?? []).map(rowToResident);
  }

  async createBilling(input: CreateCareBillingInput): Promise<CareBilling> {
    if (!Number.isInteger(input.monthlyChargeKobo) || input.monthlyChargeKobo < 0) throw new Error('P9: monthlyChargeKobo must be a non-negative integer');
    const paidKobo = input.paidKobo ?? 0;
    if (!Number.isInteger(paidKobo) || paidKobo < 0) throw new Error('P9: paidKobo must be a non-negative integer');
    const outstandingKobo = input.monthlyChargeKobo - paidKobo;
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO care_billing (id,profile_id,tenant_id,resident_ref_id,billing_period,monthly_charge_kobo,paid_kobo,outstanding_kobo,payment_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, input.residentRefId, input.billingPeriod, input.monthlyChargeKobo, paidKobo, outstandingKobo, input.paymentDate ?? null).run();
    const r = await this.db.prepare(`SELECT ${BC} FROM care_billing WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<BillingRow>();
    if (!r) throw new Error('[elderly-care] create billing failed');
    return rowToBilling(r);
  }

  async createStaffRota(input: CreateCareStaffRotaInput): Promise<CareStaffRota> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO care_staff_rota (id,profile_id,tenant_id,staff_name,role,shift_start,shift_end,created_at,updated_at) VALUES (?,?,?,?,?,?,?,unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, input.staffName, input.role, input.shiftStart, input.shiftEnd).run();
    const r = await this.db.prepare(`SELECT ${RTC} FROM care_staff_rota WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<RotaRow>();
    if (!r) throw new Error('[elderly-care] create rota failed');
    return rowToRota(r);
  }

  async listStaffRota(profileId: string, tenantId: string): Promise<CareStaffRota[]> {
    const { results } = await this.db.prepare(`SELECT ${RTC} FROM care_staff_rota WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<RotaRow>();
    return (results ?? []).map(rowToRota);
  }

  async aggregateStats(profileId: string, tenantId: string): Promise<{ activeResidents: number; totalOccupancy: number; totalOutstandingKobo: number }> {
    const res = await this.db.prepare(`SELECT COUNT(*) as cnt FROM care_residents WHERE profile_id=? AND tenant_id=? AND status='active'`).bind(profileId, tenantId).first<{ cnt: number }>();
    const billing = await this.db.prepare(`SELECT COALESCE(SUM(outstanding_kobo),0) as outstanding FROM care_billing WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).first<{ outstanding: number }>();
    const beds = await this.db.prepare(`SELECT bed_count FROM elderly_care_profiles WHERE id=? AND tenant_id=?`).bind(profileId, tenantId).first<{ bed_count: number }>();
    return { activeResidents: res?.cnt ?? 0, totalOccupancy: beds?.bed_count ?? 0, totalOutstandingKobo: billing?.outstanding ?? 0 };
  }
}
