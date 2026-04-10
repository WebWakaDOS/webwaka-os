/**
 * AirtimeResellerRepository — M12
 * T3: all queries scoped to tenantId; P9: all monetary in kobo integers
 * CBN sub-agent daily cap: 30,000,000 kobo enforced in createTransaction
 * commission_kobo is stored integer (not percentage); recipient_phone: commission tracking only (P13)
 * FSM: seeded → claimed → ncc_verified → active → suspended
 */

import type {
  AirtimeResellerProfile, AirtimeWallet, AirtimeTransaction,
  AirtimeResellerFSMState, AirtimeNetwork, AirtimeTransactionStatus,
  CreateAirtimeResellerInput, CreateAirtimeTransactionInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; business_name: string; ncc_dealer_code: string | null; cbn_sub_agent_number: string | null; status: string; created_at: number; updated_at: number; }
interface WalletRow { id: string; reseller_id: string; tenant_id: string; wallet_balance_kobo: number; daily_used_kobo: number; daily_reset_date: number; created_at: number; updated_at: number; }
interface TxRow { id: string; reseller_id: string; tenant_id: string; recipient_phone: string; network: string; amount_kobo: number; commission_kobo: number; transaction_date: number; status: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): AirtimeResellerProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, businessName: r.business_name, nccDealerCode: r.ncc_dealer_code, cbnSubAgentNumber: r.cbn_sub_agent_number, status: r.status as AirtimeResellerFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToWallet(r: WalletRow): AirtimeWallet { return { id: r.id, resellerId: r.reseller_id, tenantId: r.tenant_id, walletBalanceKobo: r.wallet_balance_kobo, dailyUsedKobo: r.daily_used_kobo, dailyResetDate: r.daily_reset_date, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToTx(r: TxRow): AirtimeTransaction { return { id: r.id, resellerId: r.reseller_id, tenantId: r.tenant_id, recipientPhone: r.recipient_phone, network: r.network as AirtimeNetwork, amountKobo: r.amount_kobo, commissionKobo: r.commission_kobo, transactionDate: r.transaction_date, status: r.status as AirtimeTransactionStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class AirtimeResellerRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateAirtimeResellerInput): Promise<AirtimeResellerProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO airtime_reseller_profiles (id,workspace_id,tenant_id,business_name,ncc_dealer_code,cbn_sub_agent_number,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.businessName, input.nccDealerCode ?? null, input.cbnSubAgentNumber ?? null, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<AirtimeResellerProfile | null> {
    const r = await this.db.prepare('SELECT * FROM airtime_reseller_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: AirtimeResellerFSMState): Promise<void> {
    await this.db.prepare('UPDATE airtime_reseller_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async findOrCreateWallet(resellerId: string, tenantId: string): Promise<AirtimeWallet> {
    const existing = await this.db.prepare('SELECT * FROM airtime_wallet WHERE reseller_id=? AND tenant_id=?').bind(resellerId, tenantId).first<WalletRow>();
    if (existing) return rowToWallet(existing);
    const id = uuid(); const ts = now(); const today = Math.floor(ts / 86400);
    await this.db.prepare('INSERT INTO airtime_wallet (id,reseller_id,tenant_id,wallet_balance_kobo,daily_used_kobo,daily_reset_date,created_at,updated_at) VALUES (?,?,?,0,0,?,?,?)').bind(id, resellerId, tenantId, today, ts, ts).run();
    return (await this.db.prepare('SELECT * FROM airtime_wallet WHERE id=? AND tenant_id=?').bind(id, tenantId).first<WalletRow>()).then(r => rowToWallet(r!));
  }

  async createTransaction(input: CreateAirtimeTransactionInput, dailyLimitKobo = 30_000_000): Promise<AirtimeTransaction> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo < 0) throw new Error('P9: amountKobo must be a non-negative integer');
    if (!Number.isInteger(input.commissionKobo) || input.commissionKobo < 0) throw new Error('P9: commissionKobo must be a non-negative integer');
    const wallet = await this.findOrCreateWallet(input.resellerId, input.tenantId);
    const today = Math.floor(now() / 86400);
    const currentDailyUsed = wallet.dailyResetDate === today ? wallet.dailyUsedKobo : 0;
    if (currentDailyUsed + input.amountKobo > dailyLimitKobo) throw new Error(`CBN sub-agent daily cap exceeded: ${currentDailyUsed + input.amountKobo} > ${dailyLimitKobo} kobo`);
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO airtime_transactions (id,reseller_id,tenant_id,recipient_phone,network,amount_kobo,commission_kobo,transaction_date,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.resellerId, input.tenantId, input.recipientPhone, input.network, input.amountKobo, input.commissionKobo, input.transactionDate, 'completed', ts, ts).run();
    await this.db.prepare('UPDATE airtime_wallet SET daily_used_kobo=?,daily_reset_date=?,updated_at=? WHERE reseller_id=? AND tenant_id=?').bind(currentDailyUsed + input.amountKobo, today, ts, input.resellerId, input.tenantId).run();
    return (await this.findTransactionById(id, input.tenantId))!;
  }

  async findTransactionById(id: string, tenantId: string): Promise<AirtimeTransaction | null> {
    const r = await this.db.prepare('SELECT * FROM airtime_transactions WHERE id=? AND tenant_id=?').bind(id, tenantId).first<TxRow>();
    return r ? rowToTx(r) : null;
  }
}
