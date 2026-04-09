/**
 * SportsAcademyRepository — M10
 * T3: all queries scoped to tenantId
 * P9: plan_fee_kobo, class_fee_kobo, purchase_cost_kobo are integers
 * P13: member_ref_id is opaque UUID — health metrics never stored for AI
 */

import type {
  SportsAcademyProfile, SportsMember, SportsClass, SportsCheckin, SportsEquipment,
  SportsAcademyFSMState,
  CreateSportsAcademyInput, UpdateSportsAcademyInput,
  CreateSportsMemberInput, CreateSportsClassInput, CreateSportsCheckinInput, CreateSportsEquipmentInput,
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

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; academy_name: string; type: string; state_sports_permit: string | null; cac_rc: string | null; status: string; created_at: number; updated_at: number; }
interface MemberRow { id: string; profile_id: string; tenant_id: string; member_ref_id: string; membership_plan: string; plan_fee_kobo: number; valid_until: number | null; status: string; created_at: number; updated_at: number; }
interface ClassRow { id: string; profile_id: string; tenant_id: string; class_name: string; trainer_id: string | null; schedule_day: string | null; schedule_time: string | null; capacity: number; enrolled_count: number; class_fee_kobo: number; created_at: number; updated_at: number; }
interface CheckinRow { id: string; profile_id: string; tenant_id: string; member_ref_id: string; class_id: string | null; check_date: number; created_at: number; }
interface EquipmentRow { id: string; profile_id: string; tenant_id: string; equipment_name: string; quantity: number; purchase_cost_kobo: number; last_service_date: number | null; status: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): SportsAcademyProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, academyName: r.academy_name, type: r.type as SportsAcademyProfile['type'], stateSportsPermit: r.state_sports_permit, cacRc: r.cac_rc, status: r.status as SportsAcademyFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToMember(r: MemberRow): SportsMember { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, memberRefId: r.member_ref_id, membershipPlan: r.membership_plan as SportsMember['membershipPlan'], planFeeKobo: r.plan_fee_kobo, validUntil: r.valid_until, status: r.status as SportsMember['status'], createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToClass(r: ClassRow): SportsClass { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, className: r.class_name, trainerId: r.trainer_id, scheduleDay: r.schedule_day, scheduleTime: r.schedule_time, capacity: r.capacity, enrolledCount: r.enrolled_count, classFeeKobo: r.class_fee_kobo, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToCheckin(r: CheckinRow): SportsCheckin { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, memberRefId: r.member_ref_id, classId: r.class_id, checkDate: r.check_date, createdAt: r.created_at }; }
function rowToEquipment(r: EquipmentRow): SportsEquipment { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, equipmentName: r.equipment_name, quantity: r.quantity, purchaseCostKobo: r.purchase_cost_kobo, lastServiceDate: r.last_service_date, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at }; }

const PC = 'id,workspace_id,tenant_id,academy_name,type,state_sports_permit,cac_rc,status,created_at,updated_at';
const MC = 'id,profile_id,tenant_id,member_ref_id,membership_plan,plan_fee_kobo,valid_until,status,created_at,updated_at';
const CC = 'id,profile_id,tenant_id,class_name,trainer_id,schedule_day,schedule_time,capacity,enrolled_count,class_fee_kobo,created_at,updated_at';
const CKC = 'id,profile_id,tenant_id,member_ref_id,class_id,check_date,created_at';
const EC = 'id,profile_id,tenant_id,equipment_name,quantity,purchase_cost_kobo,last_service_date,status,created_at,updated_at';

export class SportsAcademyRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateSportsAcademyInput): Promise<SportsAcademyProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO sports_academy_profiles (id,workspace_id,tenant_id,academy_name,type,state_sports_permit,cac_rc,status,created_at,updated_at) VALUES (?,?,?,?,?,NULL,NULL,'seeded',unixepoch(),unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.academyName, input.type ?? 'gym').run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[sports-academy] create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<SportsAcademyProfile | null> {
    const r = await this.db.prepare(`SELECT ${PC} FROM sports_academy_profiles WHERE id=? AND tenant_id=?`).bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateSportsAcademyInput & { status?: SportsAcademyFSMState }): Promise<SportsAcademyProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.academyName !== undefined) { sets.push('academy_name=?'); b.push(input.academyName); }
    if (input.type !== undefined) { sets.push('type=?'); b.push(input.type); }
    if ('stateSportsPermit' in input) { sets.push('state_sports_permit=?'); b.push(input.stateSportsPermit ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc=?'); b.push(input.cacRc ?? null); }
    if (input.status !== undefined) { sets.push('status=?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at=unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE sports_academy_profiles SET ${sets.join(',')} WHERE id=? AND tenant_id=?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transition(id: string, tenantId: string, to: SportsAcademyFSMState): Promise<SportsAcademyProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createMember(input: CreateSportsMemberInput): Promise<SportsMember> {
    if (!Number.isInteger(input.planFeeKobo) || input.planFeeKobo < 0) throw new Error('P9: planFeeKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    const ref = input.memberRefId ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO sports_members (id,profile_id,tenant_id,member_ref_id,membership_plan,plan_fee_kobo,valid_until,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'active',unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, ref, input.membershipPlan ?? 'monthly', input.planFeeKobo, input.validUntil ?? null).run();
    const r = await this.db.prepare(`SELECT ${MC} FROM sports_members WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<MemberRow>();
    if (!r) throw new Error('[sports-academy] create member failed');
    return rowToMember(r);
  }

  async listMembers(profileId: string, tenantId: string): Promise<SportsMember[]> {
    const { results } = await this.db.prepare(`SELECT ${MC} FROM sports_members WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<MemberRow>();
    return (results ?? []).map(rowToMember);
  }

  async createClass(input: CreateSportsClassInput): Promise<SportsClass> {
    if (!Number.isInteger(input.classFeeKobo ?? 0) || (input.classFeeKobo ?? 0) < 0) throw new Error('P9: classFeeKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO sports_classes (id,profile_id,tenant_id,class_name,trainer_id,schedule_day,schedule_time,capacity,enrolled_count,class_fee_kobo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,0,?,unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, input.className, input.trainerId ?? null, input.scheduleDay ?? null, input.scheduleTime ?? null, input.capacity ?? 20, input.classFeeKobo ?? 0).run();
    const r = await this.db.prepare(`SELECT ${CC} FROM sports_classes WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<ClassRow>();
    if (!r) throw new Error('[sports-academy] create class failed');
    return rowToClass(r);
  }

  async listClasses(profileId: string, tenantId: string): Promise<SportsClass[]> {
    const { results } = await this.db.prepare(`SELECT ${CC} FROM sports_classes WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<ClassRow>();
    return (results ?? []).map(rowToClass);
  }

  async createCheckin(input: CreateSportsCheckinInput): Promise<SportsCheckin> {
    const id = input.id ?? crypto.randomUUID();
    const now = input.checkDate ?? Math.floor(Date.now() / 1000);
    await this.db.prepare(`INSERT INTO sports_checkins (id,profile_id,tenant_id,member_ref_id,class_id,check_date,created_at) VALUES (?,?,?,?,?,?,unixepoch())`).bind(id, input.profileId, input.tenantId, input.memberRefId, input.classId ?? null, now).run();
    const r = await this.db.prepare(`SELECT ${CKC} FROM sports_checkins WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<CheckinRow>();
    if (!r) throw new Error('[sports-academy] create checkin failed');
    return rowToCheckin(r);
  }

  async createEquipment(input: CreateSportsEquipmentInput): Promise<SportsEquipment> {
    if (!Number.isInteger(input.purchaseCostKobo) || input.purchaseCostKobo < 0) throw new Error('P9: purchaseCostKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO sports_equipment (id,profile_id,tenant_id,equipment_name,quantity,purchase_cost_kobo,last_service_date,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'active',unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, input.equipmentName, input.quantity ?? 1, input.purchaseCostKobo, input.lastServiceDate ?? null).run();
    const r = await this.db.prepare(`SELECT ${EC} FROM sports_equipment WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<EquipmentRow>();
    if (!r) throw new Error('[sports-academy] create equipment failed');
    return rowToEquipment(r);
  }

  async listEquipment(profileId: string, tenantId: string): Promise<SportsEquipment[]> {
    const { results } = await this.db.prepare(`SELECT ${EC} FROM sports_equipment WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<EquipmentRow>();
    return (results ?? []).map(rowToEquipment);
  }

  async aggregateStats(profileId: string, tenantId: string): Promise<{ totalMembers: number; activeMembers: number; totalRevenue: number }> {
    const r = await this.db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, COALESCE(SUM(plan_fee_kobo),0) as rev FROM sports_members WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).first<{ total: number; active: number; rev: number }>();
    return { totalMembers: r?.total ?? 0, activeMembers: r?.active ?? 0, totalRevenue: r?.rev ?? 0 };
  }
}
