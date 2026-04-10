/**
 * BureauDeChangeRepository — M12
 * T3: all queries scoped to tenantId; P9: naira in kobo; USD in cents
 * FX rates stored as integer kobo per USD cent (NO floats ever)
 * customer_bvn_ref hashed before storage (P13)
 * FSM: seeded → claimed → cbn_verified → active → suspended
 */

import type {
  BdcProfile, BdcRate, BdcTransaction,
  BdcFSMState, FxCurrency, FxDirection,
  CreateBdcInput, CreateBdcRateInput, CreateBdcTransactionInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; company_name: string; cbn_bdc_licence: string | null; abcon_membership: string | null; cbn_tier: number | null; cac_rc: string | null; status: string; created_at: number; updated_at: number; }
interface RateRow { id: string; profile_id: string; tenant_id: string; rate_date: number; currency: string; buy_rate_kobo_per_cent: number; sell_rate_kobo_per_cent: number; created_at: number; updated_at: number; }
interface TxRow { id: string; profile_id: string; tenant_id: string; customer_bvn_ref: string; currency: string; usd_amount_cents: number; naira_amount_kobo: number; direction: string; transaction_date: number; efcc_report_required: number; status: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): BdcProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, companyName: r.company_name, cbnBdcLicence: r.cbn_bdc_licence, abconMembership: r.abcon_membership, cbnTier: r.cbn_tier, cacRc: r.cac_rc, status: r.status as BdcFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToRate(r: RateRow): BdcRate { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, rateDate: r.rate_date, currency: r.currency as FxCurrency, buyRateKoboPerCent: r.buy_rate_kobo_per_cent, sellRateKoboPerCent: r.sell_rate_kobo_per_cent, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToTx(r: TxRow): BdcTransaction { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, customerBvnRef: r.customer_bvn_ref, currency: r.currency as FxCurrency, usdAmountCents: r.usd_amount_cents, nairaAmountKobo: r.naira_amount_kobo, direction: r.direction as FxDirection, transactionDate: r.transaction_date, efccReportRequired: r.efcc_report_required === 1, status: r.status as 'completed' | 'reversed', createdAt: r.created_at, updatedAt: r.updated_at }; }

const EFCC_THRESHOLD_CENTS = 1_000_000; // $10,000 = 1,000,000 cents

export class BureauDeChangeRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateBdcInput): Promise<BdcProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO bdc_profiles (id,workspace_id,tenant_id,company_name,cbn_bdc_licence,abcon_membership,cbn_tier,cac_rc,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.companyName, input.cbnBdcLicence ?? null, input.abconMembership ?? null, input.cbnTier ?? null, input.cacRc ?? null, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<BdcProfile | null> {
    const r = await this.db.prepare('SELECT * FROM bdc_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: BdcFSMState): Promise<void> {
    await this.db.prepare('UPDATE bdc_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createRate(input: CreateBdcRateInput): Promise<BdcRate> {
    if (!Number.isInteger(input.buyRateKoboPerCent) || input.buyRateKoboPerCent <= 0) throw new Error('FX rate must be a positive integer (kobo per USD cent — no floats)');
    if (!Number.isInteger(input.sellRateKoboPerCent) || input.sellRateKoboPerCent <= 0) throw new Error('FX rate must be a positive integer (kobo per USD cent — no floats)');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO bdc_rates (id,profile_id,tenant_id,rate_date,currency,buy_rate_kobo_per_cent,sell_rate_kobo_per_cent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.rateDate, input.currency, input.buyRateKoboPerCent, input.sellRateKoboPerCent, ts, ts).run();
    return (await this.findRateById(id, input.tenantId))!;
  }

  async findRateById(id: string, tenantId: string): Promise<BdcRate | null> {
    const r = await this.db.prepare('SELECT * FROM bdc_rates WHERE id=? AND tenant_id=?').bind(id, tenantId).first<RateRow>();
    return r ? rowToRate(r) : null;
  }

  async createTransaction(input: CreateBdcTransactionInput): Promise<BdcTransaction> {
    if (!Number.isInteger(input.usdAmountCents) || input.usdAmountCents <= 0) throw new Error('USD amount must be a positive integer in cents (no floats)');
    if (!Number.isInteger(input.nairaAmountKobo) || input.nairaAmountKobo < 0) throw new Error('P9: nairaAmountKobo must be a non-negative integer');
    const efccRequired = input.usdAmountCents >= EFCC_THRESHOLD_CENTS;
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO bdc_transactions (id,profile_id,tenant_id,customer_bvn_ref,currency,usd_amount_cents,naira_amount_kobo,direction,transaction_date,efcc_report_required,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.customerBvnRef, input.currency, input.usdAmountCents, input.nairaAmountKobo, input.direction, input.transactionDate, efccRequired ? 1 : 0, 'completed', ts, ts).run();
    return (await this.findTransactionById(id, input.tenantId))!;
  }

  async findTransactionById(id: string, tenantId: string): Promise<BdcTransaction | null> {
    const r = await this.db.prepare('SELECT * FROM bdc_transactions WHERE id=? AND tenant_id=?').bind(id, tenantId).first<TxRow>();
    return r ? rowToTx(r) : null;
  }
}
