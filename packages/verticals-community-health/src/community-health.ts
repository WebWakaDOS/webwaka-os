/**
 * CommunityHealthRepository — M12
 * T3: all queries scoped to tenantId
 * P13: household_ref_id is opaque UUID — no names or addresses
 * P12: USSD-safe routes only (no AI on USSD)
 */

import type {
  CommunityHealthProfile, ChwWorker, ChwVisit, ChwImmunisation, ChwStock,
  CommunityHealthFSMState,
  CreateCommunityHealthInput, UpdateCommunityHealthInput,
  CreateChwWorkerInput, CreateChwVisitInput, CreateChwImmunisationInput, CreateChwStockInput,
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

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; org_name: string; nphcda_affiliation: string | null; state_moh_registration: string | null; lga: string | null; status: string; created_at: number; updated_at: number; }
interface WorkerRow { id: string; profile_id: string; tenant_id: string; chw_ref_id: string; training_level: string; lga: string | null; ward: string | null; status: string; created_at: number; updated_at: number; }
interface VisitRow { id: string; profile_id: string; tenant_id: string; chw_ref_id: string; household_ref_id: string; visit_date: number; services_provided: string | null; referral_flag: number; created_at: number; }
interface ImmRow { id: string; profile_id: string; tenant_id: string; chw_ref_id: string; vaccine_name: string; doses_administered: number; tally_date: number; lga: string | null; ward: string | null; created_at: number; }
interface StockRow { id: string; profile_id: string; tenant_id: string; item_name: string; unit_count: number; dispensed_count: number; last_restocked: number | null; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): CommunityHealthProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, orgName: r.org_name, nphcdaAffiliation: r.nphcda_affiliation, stateMohRegistration: r.state_moh_registration, lga: r.lga, status: r.status as CommunityHealthFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToWorker(r: WorkerRow): ChwWorker { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, chwRefId: r.chw_ref_id, trainingLevel: r.training_level as ChwWorker['trainingLevel'], lga: r.lga, ward: r.ward, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToVisit(r: VisitRow): ChwVisit { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, chwRefId: r.chw_ref_id, householdRefId: r.household_ref_id, visitDate: r.visit_date, servicesProvided: r.services_provided, referralFlag: Boolean(r.referral_flag), createdAt: r.created_at }; }
function rowToImm(r: ImmRow): ChwImmunisation { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, chwRefId: r.chw_ref_id, vaccineName: r.vaccine_name, dosesAdministered: r.doses_administered, tallyDate: r.tally_date, lga: r.lga, ward: r.ward, createdAt: r.created_at }; }
function rowToStock(r: StockRow): ChwStock { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, itemName: r.item_name, unitCount: r.unit_count, dispensedCount: r.dispensed_count, lastRestocked: r.last_restocked, createdAt: r.created_at, updatedAt: r.updated_at }; }

const PC = 'id,workspace_id,tenant_id,org_name,nphcda_affiliation,state_moh_registration,lga,status,created_at,updated_at';
const WC = 'id,profile_id,tenant_id,chw_ref_id,training_level,lga,ward,status,created_at,updated_at';
const VC = 'id,profile_id,tenant_id,chw_ref_id,household_ref_id,visit_date,services_provided,referral_flag,created_at';
const IC = 'id,profile_id,tenant_id,chw_ref_id,vaccine_name,doses_administered,tally_date,lga,ward,created_at';
const SC = 'id,profile_id,tenant_id,item_name,unit_count,dispensed_count,last_restocked,created_at,updated_at';

export class CommunityHealthRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateCommunityHealthInput): Promise<CommunityHealthProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO community_health_profiles (id,workspace_id,tenant_id,org_name,nphcda_affiliation,state_moh_registration,lga,status,created_at,updated_at) VALUES (?,?,?,?,NULL,NULL,NULL,'seeded',unixepoch(),unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.orgName).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[community-health] create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<CommunityHealthProfile | null> {
    const r = await this.db.prepare(`SELECT ${PC} FROM community_health_profiles WHERE id=? AND tenant_id=?`).bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateCommunityHealthInput & { status?: CommunityHealthFSMState }): Promise<CommunityHealthProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.orgName !== undefined) { sets.push('org_name=?'); b.push(input.orgName); }
    if ('nphcdaAffiliation' in input) { sets.push('nphcda_affiliation=?'); b.push(input.nphcdaAffiliation ?? null); }
    if ('stateMohRegistration' in input) { sets.push('state_moh_registration=?'); b.push(input.stateMohRegistration ?? null); }
    if ('lga' in input) { sets.push('lga=?'); b.push(input.lga ?? null); }
    if (input.status !== undefined) { sets.push('status=?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at=unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE community_health_profiles SET ${sets.join(',')} WHERE id=? AND tenant_id=?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transition(id: string, tenantId: string, to: CommunityHealthFSMState): Promise<CommunityHealthProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createWorker(input: CreateChwWorkerInput): Promise<ChwWorker> {
    const id = input.id ?? crypto.randomUUID();
    const ref = input.chwRefId ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO chw_workers (id,profile_id,tenant_id,chw_ref_id,training_level,lga,ward,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'active',unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, ref, input.trainingLevel ?? 'CHW', input.lga ?? null, input.ward ?? null).run();
    const r = await this.db.prepare(`SELECT ${WC} FROM chw_workers WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<WorkerRow>();
    if (!r) throw new Error('[community-health] create worker failed');
    return rowToWorker(r);
  }

  async listWorkers(profileId: string, tenantId: string): Promise<ChwWorker[]> {
    const { results } = await this.db.prepare(`SELECT ${WC} FROM chw_workers WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<WorkerRow>();
    return (results ?? []).map(rowToWorker);
  }

  async createVisit(input: CreateChwVisitInput): Promise<ChwVisit> {
    const id = input.id ?? crypto.randomUUID();
    const hhRef = input.householdRefId ?? crypto.randomUUID();
    const now = input.visitDate ?? Math.floor(Date.now() / 1000);
    await this.db.prepare(`INSERT INTO chw_visits (id,profile_id,tenant_id,chw_ref_id,household_ref_id,visit_date,services_provided,referral_flag,created_at) VALUES (?,?,?,?,?,?,?,?,unixepoch())`).bind(id, input.profileId, input.tenantId, input.chwRefId, hhRef, now, input.servicesProvided ?? null, input.referralFlag ? 1 : 0).run();
    const r = await this.db.prepare(`SELECT ${VC} FROM chw_visits WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<VisitRow>();
    if (!r) throw new Error('[community-health] create visit failed');
    return rowToVisit(r);
  }

  async listVisits(profileId: string, tenantId: string): Promise<ChwVisit[]> {
    const { results } = await this.db.prepare(`SELECT ${VC} FROM chw_visits WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<VisitRow>();
    return (results ?? []).map(rowToVisit);
  }

  async createImmunisation(input: CreateChwImmunisationInput): Promise<ChwImmunisation> {
    if (!Number.isInteger(input.dosesAdministered) || input.dosesAdministered < 0) throw new Error('dosesAdministered must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    const now = input.tallyDate ?? Math.floor(Date.now() / 1000);
    await this.db.prepare(`INSERT INTO chw_immunisation (id,profile_id,tenant_id,chw_ref_id,vaccine_name,doses_administered,tally_date,lga,ward,created_at) VALUES (?,?,?,?,?,?,?,?,?,unixepoch())`).bind(id, input.profileId, input.tenantId, input.chwRefId, input.vaccineName, input.dosesAdministered, now, input.lga ?? null, input.ward ?? null).run();
    const r = await this.db.prepare(`SELECT ${IC} FROM chw_immunisation WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<ImmRow>();
    if (!r) throw new Error('[community-health] create immunisation failed');
    return rowToImm(r);
  }

  async createStock(input: CreateChwStockInput): Promise<ChwStock> {
    if (!Number.isInteger(input.unitCount ?? 0) || (input.unitCount ?? 0) < 0) throw new Error('unitCount must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO chw_stock (id,profile_id,tenant_id,item_name,unit_count,dispensed_count,last_restocked,created_at,updated_at) VALUES (?,?,?,?,?,?,NULL,unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, input.itemName, input.unitCount ?? 0, input.dispensedCount ?? 0).run();
    const r = await this.db.prepare(`SELECT ${SC} FROM chw_stock WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<StockRow>();
    if (!r) throw new Error('[community-health] create stock failed');
    return rowToStock(r);
  }

  async listStock(profileId: string, tenantId: string): Promise<ChwStock[]> {
    const { results } = await this.db.prepare(`SELECT ${SC} FROM chw_stock WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<StockRow>();
    return (results ?? []).map(rowToStock);
  }

  async aggregateStats(profileId: string, tenantId: string): Promise<{ totalVisits: number; totalReferrals: number; totalWorkers: number }> {
    const vr = await this.db.prepare(`SELECT COUNT(*) as cnt, SUM(referral_flag) as refs FROM chw_visits WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).first<{ cnt: number; refs: number }>();
    const wr = await this.db.prepare(`SELECT COUNT(*) as cnt FROM chw_workers WHERE profile_id=? AND tenant_id=? AND status='active'`).bind(profileId, tenantId).first<{ cnt: number }>();
    return { totalVisits: vr?.cnt ?? 0, totalReferrals: vr?.refs ?? 0, totalWorkers: wr?.cnt ?? 0 };
  }
}
