/**
 * PollingUnitRepository — M12
 * T3: all queries scoped to tenantId
 * L3 HITL MANDATORY on ALL AI — enforced at route level
 * ABSOLUTE RULE: NO voter PII stored — only aggregate INTEGER counts
 * registered_voters, accredited_count, votes_cast: non-negative integers
 * FSM: seeded → claimed → inec_accredited → active → suspended
 */

import type {
  PollingUnitProfile, PollingUnit, ElectionEvent,
  PollingUnitFSMState,
  CreatePollingUnitProfileInput, CreatePollingUnitInput, CreateElectionEventInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; org_name: string; inec_accreditation: string | null; state: string; lga: string; status: string; created_at: number; updated_at: number; }
interface UnitRow { id: string; profile_id: string; tenant_id: string; unit_code: string; ward_name: string; lga: string; state: string; registered_voters: number; created_at: number; updated_at: number; }
interface EventRow { id: string; unit_id: string; profile_id: string; tenant_id: string; election_name: string; election_date: number; accredited_count: number; votes_cast: number; form_ref: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): PollingUnitProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, orgName: r.org_name, inecAccreditation: r.inec_accreditation, state: r.state, lga: r.lga, status: r.status as PollingUnitFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToUnit(r: UnitRow): PollingUnit { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, unitCode: r.unit_code, wardName: r.ward_name, lga: r.lga, state: r.state, registeredVoters: r.registered_voters, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToEvent(r: EventRow): ElectionEvent { return { id: r.id, unitId: r.unit_id, profileId: r.profile_id, tenantId: r.tenant_id, electionName: r.election_name, electionDate: r.election_date, accreditedCount: r.accredited_count, votesCast: r.votes_cast, formRef: r.form_ref, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class PollingUnitRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreatePollingUnitProfileInput): Promise<PollingUnitProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO polling_unit_profiles (id,workspace_id,tenant_id,org_name,inec_accreditation,state,lga,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.orgName, input.inecAccreditation ?? null, input.state, input.lga, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<PollingUnitProfile | null> {
    const r = await this.db.prepare('SELECT * FROM polling_unit_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: PollingUnitFSMState): Promise<void> {
    await this.db.prepare('UPDATE polling_unit_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createPollingUnit(input: CreatePollingUnitInput): Promise<PollingUnit> {
    if (!Number.isInteger(input.registeredVoters) || input.registeredVoters < 0) throw new Error('registeredVoters must be a non-negative integer (aggregate count only — no voter PII)');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO polling_units (id,profile_id,tenant_id,unit_code,ward_name,lga,state,registered_voters,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.unitCode, input.wardName, input.lga, input.state, input.registeredVoters, ts, ts).run();
    return (await this.findPollingUnitById(id, input.tenantId))!;
  }

  async findPollingUnitById(id: string, tenantId: string): Promise<PollingUnit | null> {
    const r = await this.db.prepare('SELECT * FROM polling_units WHERE id=? AND tenant_id=?').bind(id, tenantId).first<UnitRow>();
    return r ? rowToUnit(r) : null;
  }

  async createElectionEvent(input: CreateElectionEventInput): Promise<ElectionEvent> {
    if (!Number.isInteger(input.accreditedCount) || input.accreditedCount < 0) throw new Error('accreditedCount must be a non-negative integer');
    if (!Number.isInteger(input.votesCast) || input.votesCast < 0) throw new Error('votesCast must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO election_events (id,unit_id,profile_id,tenant_id,election_name,election_date,accredited_count,votes_cast,form_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.unitId, input.profileId, input.tenantId, input.electionName, input.electionDate, input.accreditedCount, input.votesCast, input.formRef, ts, ts).run();
    return (await this.findElectionEventById(id, input.tenantId))!;
  }

  async findElectionEventById(id: string, tenantId: string): Promise<ElectionEvent | null> {
    const r = await this.db.prepare('SELECT * FROM election_events WHERE id=? AND tenant_id=?').bind(id, tenantId).first<EventRow>();
    return r ? rowToEvent(r) : null;
  }
}
