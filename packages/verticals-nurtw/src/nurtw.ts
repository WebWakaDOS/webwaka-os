import type {
  NurtwProfile, CreateNurtwInput, UpdateNurtwInput, NurtwFSMState,
  UnionMember, CreateUnionMemberInput,
  UnionDuesLog, CreateUnionDuesLogInput,
  UnionWelfareClaim, CreateWelfareClaimInput, WelfareClaimStatus,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, union_name, chapter_level, nurtw_registration, state, status, created_at, updated_at';
const MEMBER_COLS = 'id, profile_id, tenant_id, member_name, vehicle_plate, vehicle_type, member_since, monthly_dues_kobo, dues_status, created_at, updated_at';
const DUES_COLS = 'id, member_id, profile_id, tenant_id, collection_date, amount_kobo, collector_id, created_at, updated_at';
const WELFARE_COLS = 'id, member_id, profile_id, tenant_id, claim_type, amount_kobo, status, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): NurtwProfile {
  return {
    id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string,
    unionName: r['union_name'] as string, chapterLevel: r['chapter_level'] as NurtwProfile['chapterLevel'],
    nurtwRegistration: r['nurtw_registration'] as string | null, state: r['state'] as string | null,
    status: r['status'] as NurtwFSMState,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToMember(r: Record<string, unknown>): UnionMember {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    memberName: r['member_name'] as string, vehiclePlate: r['vehicle_plate'] as string | null,
    vehicleType: r['vehicle_type'] as string | null, memberSince: r['member_since'] as number | null,
    monthlyDuesKobo: r['monthly_dues_kobo'] as number,
    duesStatus: r['dues_status'] as UnionMember['duesStatus'],
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToDues(r: Record<string, unknown>): UnionDuesLog {
  return {
    id: r['id'] as string, memberId: r['member_id'] as string, profileId: r['profile_id'] as string,
    tenantId: r['tenant_id'] as string, collectionDate: r['collection_date'] as number | null,
    amountKobo: r['amount_kobo'] as number, collectorId: r['collector_id'] as string | null,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToWelfare(r: Record<string, unknown>): UnionWelfareClaim {
  return {
    id: r['id'] as string, memberId: r['member_id'] as string, profileId: r['profile_id'] as string,
    tenantId: r['tenant_id'] as string, claimType: r['claim_type'] as UnionWelfareClaim['claimType'],
    amountKobo: r['amount_kobo'] as number, status: r['status'] as WelfareClaimStatus,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

export class NurtwRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateNurtwInput): Promise<NurtwProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO nurtw_profiles (id, workspace_id, tenant_id, union_name, chapter_level, nurtw_registration, state, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.unionName, input.chapterLevel ?? 'park', input.nurtwRegistration ?? null, input.state ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[nurtw] profile create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<NurtwProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM nurtw_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<NurtwProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM nurtw_profiles WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateNurtwInput): Promise<NurtwProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.unionName !== undefined) { sets.push('union_name = ?'); vals.push(input.unionName); }
    if (input.chapterLevel !== undefined) { sets.push('chapter_level = ?'); vals.push(input.chapterLevel); }
    if (input.nurtwRegistration !== undefined) { sets.push('nurtw_registration = ?'); vals.push(input.nurtwRegistration); }
    if (input.state !== undefined) { sets.push('state = ?'); vals.push(input.state); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    await this.db.prepare(`UPDATE nurtw_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionStatus(id: string, tenantId: string, to: NurtwFSMState): Promise<NurtwProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createMember(input: CreateUnionMemberInput): Promise<UnionMember> {
    if (!Number.isInteger(input.monthlyDuesKobo) || input.monthlyDuesKobo < 0) throw new Error('[nurtw] monthlyDuesKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO union_members (id, profile_id, tenant_id, member_name, vehicle_plate, vehicle_type, member_since, monthly_dues_kobo, dues_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'current', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.memberName, input.vehiclePlate ?? null, input.vehicleType ?? null, input.memberSince ?? null, input.monthlyDuesKobo).run();
    const m = await this.db.prepare(`SELECT ${MEMBER_COLS} FROM union_members WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!m) throw new Error('[nurtw] member create failed');
    return rowToMember(m);
  }

  async listMembers(profileId: string, tenantId: string): Promise<UnionMember[]> {
    const { results } = await this.db.prepare(`SELECT ${MEMBER_COLS} FROM union_members WHERE profile_id = ? AND tenant_id = ? ORDER BY member_name ASC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToMember);
  }

  async createDuesLog(input: CreateUnionDuesLogInput): Promise<UnionDuesLog> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) throw new Error('[nurtw] amountKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO union_dues_log (id, member_id, profile_id, tenant_id, collection_date, amount_kobo, collector_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.memberId, input.profileId, input.tenantId, input.collectionDate ?? null, input.amountKobo, input.collectorId ?? null).run();
    const d = await this.db.prepare(`SELECT ${DUES_COLS} FROM union_dues_log WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!d) throw new Error('[nurtw] dues log create failed');
    return rowToDues(d);
  }

  async listDuesLog(memberId: string, tenantId: string): Promise<UnionDuesLog[]> {
    const { results } = await this.db.prepare(`SELECT ${DUES_COLS} FROM union_dues_log WHERE member_id = ? AND tenant_id = ? ORDER BY collection_date DESC`).bind(memberId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToDues);
  }

  async createWelfareClaim(input: CreateWelfareClaimInput): Promise<UnionWelfareClaim> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) throw new Error('[nurtw] amountKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO union_welfare_claims (id, member_id, profile_id, tenant_id, claim_type, amount_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'submitted', unixepoch(), unixepoch())`).bind(id, input.memberId, input.profileId, input.tenantId, input.claimType ?? 'medical', input.amountKobo).run();
    const w = await this.db.prepare(`SELECT ${WELFARE_COLS} FROM union_welfare_claims WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!w) throw new Error('[nurtw] welfare claim create failed');
    return rowToWelfare(w);
  }

  async listWelfareClaims(profileId: string, tenantId: string): Promise<UnionWelfareClaim[]> {
    const { results } = await this.db.prepare(`SELECT ${WELFARE_COLS} FROM union_welfare_claims WHERE profile_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToWelfare);
  }

  async updateWelfareClaimStatus(id: string, tenantId: string, status: WelfareClaimStatus): Promise<UnionWelfareClaim | null> {
    await this.db.prepare(`UPDATE union_welfare_claims SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    const row = await this.db.prepare(`SELECT ${WELFARE_COLS} FROM union_welfare_claims WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToWelfare(row) : null;
  }
}
