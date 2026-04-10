/**
 * MobileMoneyAgentRepository — M12
 * T3: all queries scoped to tenantId; P9: all monetary in kobo
 * Daily cap enforced in createTransaction; customer_bvn_ref hashed (P13)
 * FSM: seeded → claimed → cbn_agent_verified → active → suspended
 */

import type {
  MobileMoneyAgentProfile, MmFloat, MmTransaction,
  MobileMoneyAgentFSMState, MmTransactionType, MmTransactionStatus,
  CreateMobileMoneyAgentInput, CreateMmTransactionInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; agent_name: string; cbn_sub_agent_number: string | null; super_agent_provider: string | null; super_agent_licence_number: string | null; cac_or_tin: string | null; status: string; created_at: number; updated_at: number; }
interface FloatRow { id: string; agent_id: string; tenant_id: string; float_balance_kobo: number; daily_used_kobo: number; daily_limit_kobo: number; last_topup_kobo: number; last_topup_date: number; created_at: number; updated_at: number; }
interface TxRow { id: string; agent_id: string; tenant_id: string; transaction_type: string; amount_kobo: number; commission_kobo: number; customer_bvn_ref: string; reference_number: string; transaction_date: number; status: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): MobileMoneyAgentProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, agentName: r.agent_name, cbnSubAgentNumber: r.cbn_sub_agent_number, superAgentProvider: r.super_agent_provider, superAgentLicenceNumber: r.super_agent_licence_number, cacOrTin: r.cac_or_tin, status: r.status as MobileMoneyAgentFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToFloat(r: FloatRow): MmFloat { return { id: r.id, agentId: r.agent_id, tenantId: r.tenant_id, floatBalanceKobo: r.float_balance_kobo, dailyUsedKobo: r.daily_used_kobo, dailyLimitKobo: r.daily_limit_kobo, lastTopupKobo: r.last_topup_kobo, lastTopupDate: r.last_topup_date, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToTx(r: TxRow): MmTransaction { return { id: r.id, agentId: r.agent_id, tenantId: r.tenant_id, transactionType: r.transaction_type as MmTransactionType, amountKobo: r.amount_kobo, commissionKobo: r.commission_kobo, customerBvnRef: r.customer_bvn_ref, referenceNumber: r.reference_number, transactionDate: r.transaction_date, status: r.status as MmTransactionStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class MobileMoneyAgentRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateMobileMoneyAgentInput): Promise<MobileMoneyAgentProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO mobile_money_agent_profiles (id,workspace_id,tenant_id,agent_name,cbn_sub_agent_number,super_agent_provider,super_agent_licence_number,cac_or_tin,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.agentName, input.cbnSubAgentNumber ?? null, input.superAgentProvider ?? null, input.superAgentLicenceNumber ?? null, input.cacOrTin ?? null, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<MobileMoneyAgentProfile | null> {
    const r = await this.db.prepare('SELECT * FROM mobile_money_agent_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: MobileMoneyAgentFSMState): Promise<void> {
    await this.db.prepare('UPDATE mobile_money_agent_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async findOrCreateFloat(agentId: string, tenantId: string): Promise<MmFloat> {
    const existing = await this.db.prepare('SELECT * FROM mm_float WHERE agent_id=? AND tenant_id=?').bind(agentId, tenantId).first<FloatRow>();
    if (existing) return rowToFloat(existing);
    const id = uuid(); const ts = now();
    await this.db.prepare('INSERT INTO mm_float (id,agent_id,tenant_id,float_balance_kobo,daily_used_kobo,daily_limit_kobo,last_topup_kobo,last_topup_date,created_at,updated_at) VALUES (?,?,?,0,0,30000000,0,0,?,?)').bind(id, agentId, tenantId, ts, ts).run();
    return rowToFloat((await this.db.prepare('SELECT * FROM mm_float WHERE id=?').bind(id).first<FloatRow>())!);
  }

  async createTransaction(input: CreateMmTransactionInput): Promise<MmTransaction> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo < 0) throw new Error('P9: amountKobo must be a non-negative integer');
    if (!Number.isInteger(input.commissionKobo) || input.commissionKobo < 0) throw new Error('P9: commissionKobo must be a non-negative integer');
    const float = await this.findOrCreateFloat(input.agentId, input.tenantId);
    if (float.dailyUsedKobo + input.amountKobo > float.dailyLimitKobo) throw new Error(`CBN daily cap exceeded: would reach ${float.dailyUsedKobo + input.amountKobo} kobo, limit is ${float.dailyLimitKobo} kobo`);
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO mm_transactions (id,agent_id,tenant_id,transaction_type,amount_kobo,commission_kobo,customer_bvn_ref,reference_number,transaction_date,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.agentId, input.tenantId, input.transactionType, input.amountKobo, input.commissionKobo, input.customerBvnRef, input.referenceNumber, input.transactionDate, 'completed', ts, ts).run();
    await this.db.prepare('UPDATE mm_float SET daily_used_kobo=daily_used_kobo+?,float_balance_kobo=float_balance_kobo-?,updated_at=? WHERE agent_id=? AND tenant_id=?').bind(input.amountKobo, input.amountKobo, ts, input.agentId, input.tenantId).run();
    return (await this.findTransactionById(id, input.tenantId))!;
  }

  async findTransactionById(id: string, tenantId: string): Promise<MmTransaction | null> {
    const r = await this.db.prepare('SELECT * FROM mm_transactions WHERE id=? AND tenant_id=?').bind(id, tenantId).first<TxRow>();
    return r ? rowToTx(r) : null;
  }

  async topupFloat(agentId: string, tenantId: string, amountKobo: number): Promise<MmFloat> {
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new Error('P9: topup amountKobo must be a positive integer');
    const ts = now();
    await this.db.prepare('UPDATE mm_float SET float_balance_kobo=float_balance_kobo+?,last_topup_kobo=?,last_topup_date=?,updated_at=? WHERE agent_id=? AND tenant_id=?').bind(amountKobo, amountKobo, ts, ts, agentId, tenantId).run();
    return (await this.db.prepare('SELECT * FROM mm_float WHERE agent_id=? AND tenant_id=?').bind(agentId, tenantId).first<FloatRow>()).then(r => rowToFloat(r!));
  }
}
