/**
 * RehabCentreRepository — M12
 * T3: all queries scoped to tenantId
 * P9: total_fee_kobo, deposit_kobo, balance_kobo are integers
 * P13 CRITICAL: resident_ref_id is opaque UUID — NO name, condition, substance, diagnosis in ANY field
 * L3 HITL mandatory for ALL SuperAgent calls — enforced at route and guard layer
 */

import type {
  RehabCentreProfile, RehabProgramme, RehabEnrolment, RehabSession,
  RehabCentreFSMState,
  CreateRehabCentreInput, UpdateRehabCentreInput,
  CreateRehabProgrammeInput, CreateRehabEnrolmentInput, CreateRehabSessionInput,
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

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; centre_name: string; ndlea_licence: string | null; fmhsw_registration: string | null; cac_rc: string | null; bed_count: number; status: string; created_at: number; updated_at: number; }
interface ProgrammeRow { id: string; profile_id: string; tenant_id: string; programme_name: string; duration_days: number; total_fee_kobo: number; programme_type: string; created_at: number; updated_at: number; }
interface EnrolmentRow { id: string; profile_id: string; tenant_id: string; resident_ref_id: string; programme_id: string; enrolment_date: number; deposit_kobo: number; balance_kobo: number; status: string; created_at: number; updated_at: number; }
interface SessionRow { id: string; profile_id: string; tenant_id: string; resident_ref_id: string; session_date: number; facilitator_id: string; session_type: string; created_at: number; }

function rowToProfile(r: ProfileRow): RehabCentreProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, centreName: r.centre_name, ndleaLicence: r.ndlea_licence, fmhswRegistration: r.fmhsw_registration, cacRc: r.cac_rc, bedCount: r.bed_count, status: r.status as RehabCentreFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToProgramme(r: ProgrammeRow): RehabProgramme { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, programmeName: r.programme_name, durationDays: r.duration_days, totalFeeKobo: r.total_fee_kobo, programmeType: r.programme_type as RehabProgramme['programmeType'], createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToEnrolment(r: EnrolmentRow): RehabEnrolment { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, residentRefId: r.resident_ref_id, programmeId: r.programme_id, enrolmentDate: r.enrolment_date, depositKobo: r.deposit_kobo, balanceKobo: r.balance_kobo, status: r.status as RehabEnrolment['status'], createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToSession(r: SessionRow): RehabSession { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, residentRefId: r.resident_ref_id, sessionDate: r.session_date, facilitatorId: r.facilitator_id, sessionType: r.session_type as RehabSession['sessionType'], createdAt: r.created_at }; }

const PC = 'id,workspace_id,tenant_id,centre_name,ndlea_licence,fmhsw_registration,cac_rc,bed_count,status,created_at,updated_at';
const PRC = 'id,profile_id,tenant_id,programme_name,duration_days,total_fee_kobo,programme_type,created_at,updated_at';
const EC = 'id,profile_id,tenant_id,resident_ref_id,programme_id,enrolment_date,deposit_kobo,balance_kobo,status,created_at,updated_at';
const SC = 'id,profile_id,tenant_id,resident_ref_id,session_date,facilitator_id,session_type,created_at';

export class RehabCentreRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateRehabCentreInput): Promise<RehabCentreProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO rehab_centre_profiles (id,workspace_id,tenant_id,centre_name,ndlea_licence,fmhsw_registration,cac_rc,bed_count,status,created_at,updated_at) VALUES (?,?,?,?,NULL,NULL,NULL,?,'seeded',unixepoch(),unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.centreName, input.bedCount ?? 0).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[rehab-centre] create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<RehabCentreProfile | null> {
    const r = await this.db.prepare(`SELECT ${PC} FROM rehab_centre_profiles WHERE id=? AND tenant_id=?`).bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateRehabCentreInput & { status?: RehabCentreFSMState }): Promise<RehabCentreProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.centreName !== undefined) { sets.push('centre_name=?'); b.push(input.centreName); }
    if ('ndleaLicence' in input) { sets.push('ndlea_licence=?'); b.push(input.ndleaLicence ?? null); }
    if ('fmhswRegistration' in input) { sets.push('fmhsw_registration=?'); b.push(input.fmhswRegistration ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc=?'); b.push(input.cacRc ?? null); }
    if (input.bedCount !== undefined) { sets.push('bed_count=?'); b.push(input.bedCount); }
    if (input.status !== undefined) { sets.push('status=?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at=unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE rehab_centre_profiles SET ${sets.join(',')} WHERE id=? AND tenant_id=?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transition(id: string, tenantId: string, to: RehabCentreFSMState): Promise<RehabCentreProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createProgramme(input: CreateRehabProgrammeInput): Promise<RehabProgramme> {
    if (!Number.isInteger(input.totalFeeKobo) || input.totalFeeKobo < 0) throw new Error('P9: totalFeeKobo must be a non-negative integer');
    if (!Number.isInteger(input.durationDays) || input.durationDays <= 0) throw new Error('durationDays must be a positive integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO rehab_programmes (id,profile_id,tenant_id,programme_name,duration_days,total_fee_kobo,programme_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, input.programmeName, input.durationDays, input.totalFeeKobo, input.programmeType ?? 'residential').run();
    const r = await this.db.prepare(`SELECT ${PRC} FROM rehab_programmes WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<ProgrammeRow>();
    if (!r) throw new Error('[rehab-centre] create programme failed');
    return rowToProgramme(r);
  }

  async listProgrammes(profileId: string, tenantId: string): Promise<RehabProgramme[]> {
    const { results } = await this.db.prepare(`SELECT ${PRC} FROM rehab_programmes WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<ProgrammeRow>();
    return (results ?? []).map(rowToProgramme);
  }

  async createEnrolment(input: CreateRehabEnrolmentInput): Promise<RehabEnrolment> {
    if (!Number.isInteger(input.depositKobo) || input.depositKobo < 0) throw new Error('P9: depositKobo must be a non-negative integer');
    if (!Number.isInteger(input.balanceKobo)) throw new Error('P9: balanceKobo must be an integer');
    const id = input.id ?? crypto.randomUUID();
    const residentRef = input.residentRefId ?? crypto.randomUUID();
    const now = input.enrolmentDate ?? Math.floor(Date.now() / 1000);
    await this.db.prepare(`INSERT INTO rehab_enrolments (id,profile_id,tenant_id,resident_ref_id,programme_id,enrolment_date,deposit_kobo,balance_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'active',unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, residentRef, input.programmeId, now, input.depositKobo, input.balanceKobo).run();
    const r = await this.db.prepare(`SELECT ${EC} FROM rehab_enrolments WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<EnrolmentRow>();
    if (!r) throw new Error('[rehab-centre] create enrolment failed');
    return rowToEnrolment(r);
  }

  async listEnrolments(profileId: string, tenantId: string): Promise<RehabEnrolment[]> {
    const { results } = await this.db.prepare(`SELECT ${EC} FROM rehab_enrolments WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<EnrolmentRow>();
    return (results ?? []).map(rowToEnrolment);
  }

  async createSession(input: CreateRehabSessionInput): Promise<RehabSession> {
    const id = input.id ?? crypto.randomUUID();
    const now = input.sessionDate ?? Math.floor(Date.now() / 1000);
    await this.db.prepare(`INSERT INTO rehab_sessions (id,profile_id,tenant_id,resident_ref_id,session_date,facilitator_id,session_type,created_at) VALUES (?,?,?,?,?,?,?,unixepoch())`).bind(id, input.profileId, input.tenantId, input.residentRefId, now, input.facilitatorId, input.sessionType ?? 'group').run();
    const r = await this.db.prepare(`SELECT ${SC} FROM rehab_sessions WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<SessionRow>();
    if (!r) throw new Error('[rehab-centre] create session failed');
    return rowToSession(r);
  }

  async listSessions(profileId: string, tenantId: string): Promise<RehabSession[]> {
    const { results } = await this.db.prepare(`SELECT ${SC} FROM rehab_sessions WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<SessionRow>();
    return (results ?? []).map(rowToSession);
  }

  async aggregateStats(profileId: string, tenantId: string): Promise<{ activeProgrammes: number; activeEnrolments: number; completedEnrolments: number }> {
    const progs = await this.db.prepare(`SELECT COUNT(*) as cnt FROM rehab_programmes WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).first<{ cnt: number }>();
    const enrolStats = await this.db.prepare(`SELECT SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active_cnt, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed_cnt FROM rehab_enrolments WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).first<{ active_cnt: number; completed_cnt: number }>();
    return { activeProgrammes: progs?.cnt ?? 0, activeEnrolments: enrolStats?.active_cnt ?? 0, completedEnrolments: enrolStats?.completed_cnt ?? 0 };
  }
}
