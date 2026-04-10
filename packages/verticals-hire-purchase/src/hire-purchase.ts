/**
 * HirePurchaseRepository — M12
 * T3: all queries scoped to tenantId; P9: all monetary in kobo; installments/tenor as integers
 * customer_bvn_ref hashed before storage (P13)
 * outstanding_kobo decrements correctly on repayment
 * FSM: seeded → claimed → cbn_verified → active → suspended
 */

import type {
  HirePurchaseProfile, HpAsset, HpAgreement, HpRepayment,
  HirePurchaseFSMState, AssetType, AssetStatus, AgreementStatus,
  CreateHirePurchaseInput, CreateHpAssetInput, CreateHpAgreementInput, CreateHpRepaymentInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; company_name: string; cbn_consumer_credit_reg: string | null; cac_rc: string | null; status: string; created_at: number; updated_at: number; }
interface AssetRow { id: string; profile_id: string; tenant_id: string; asset_type: string; serial_number: string; asset_value_kobo: number; status: string; created_at: number; updated_at: number; }
interface AgreementRow { id: string; profile_id: string; tenant_id: string; customer_bvn_ref: string; asset_id: string; total_hp_value_kobo: number; deposit_kobo: number; installments: number; installment_amount_kobo: number; tenor_months: number; start_date: number; outstanding_kobo: number; status: string; created_at: number; updated_at: number; }
interface RepaymentRow { id: string; agreement_id: string; tenant_id: string; payment_date: number; amount_kobo: number; outstanding_after_kobo: number; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): HirePurchaseProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, companyName: r.company_name, cbnConsumerCreditReg: r.cbn_consumer_credit_reg, cacRc: r.cac_rc, status: r.status as HirePurchaseFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToAsset(r: AssetRow): HpAsset { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, assetType: r.asset_type as AssetType, serialNumber: r.serial_number, assetValueKobo: r.asset_value_kobo, status: r.status as AssetStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToAgreement(r: AgreementRow): HpAgreement { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, customerBvnRef: r.customer_bvn_ref, assetId: r.asset_id, totalHpValueKobo: r.total_hp_value_kobo, depositKobo: r.deposit_kobo, installments: r.installments, installmentAmountKobo: r.installment_amount_kobo, tenorMonths: r.tenor_months, startDate: r.start_date, outstandingKobo: r.outstanding_kobo, status: r.status as AgreementStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToRepayment(r: RepaymentRow): HpRepayment { return { id: r.id, agreementId: r.agreement_id, tenantId: r.tenant_id, paymentDate: r.payment_date, amountKobo: r.amount_kobo, outstandingAfterKobo: r.outstanding_after_kobo, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class HirePurchaseRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateHirePurchaseInput): Promise<HirePurchaseProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO hire_purchase_profiles (id,workspace_id,tenant_id,company_name,cbn_consumer_credit_reg,cac_rc,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.companyName, input.cbnConsumerCreditReg ?? null, input.cacRc ?? null, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<HirePurchaseProfile | null> {
    const r = await this.db.prepare('SELECT * FROM hire_purchase_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: HirePurchaseFSMState): Promise<void> {
    await this.db.prepare('UPDATE hire_purchase_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createAsset(input: CreateHpAssetInput): Promise<HpAsset> {
    if (!Number.isInteger(input.assetValueKobo) || input.assetValueKobo < 0) throw new Error('P9: assetValueKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO hp_assets (id,profile_id,tenant_id,asset_type,serial_number,asset_value_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.assetType, input.serialNumber, input.assetValueKobo, 'available', ts, ts).run();
    return (await this.findAssetById(id, input.tenantId))!;
  }

  async findAssetById(id: string, tenantId: string): Promise<HpAsset | null> {
    const r = await this.db.prepare('SELECT * FROM hp_assets WHERE id=? AND tenant_id=?').bind(id, tenantId).first<AssetRow>();
    return r ? rowToAsset(r) : null;
  }

  async createAgreement(input: CreateHpAgreementInput): Promise<HpAgreement> {
    if (!Number.isInteger(input.totalHpValueKobo) || input.totalHpValueKobo < 0) throw new Error('P9: totalHpValueKobo must be a non-negative integer');
    if (!Number.isInteger(input.depositKobo) || input.depositKobo < 0) throw new Error('P9: depositKobo must be a non-negative integer');
    if (!Number.isInteger(input.installmentAmountKobo) || input.installmentAmountKobo < 0) throw new Error('P9: installmentAmountKobo must be a non-negative integer');
    if (!Number.isInteger(input.installments) || input.installments <= 0) throw new Error('installments must be a positive integer');
    if (!Number.isInteger(input.tenorMonths) || input.tenorMonths <= 0) throw new Error('tenorMonths must be a positive integer');
    const outstanding = input.totalHpValueKobo - input.depositKobo;
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO hp_agreements (id,profile_id,tenant_id,customer_bvn_ref,asset_id,total_hp_value_kobo,deposit_kobo,installments,installment_amount_kobo,tenor_months,start_date,outstanding_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.customerBvnRef, input.assetId, input.totalHpValueKobo, input.depositKobo, input.installments, input.installmentAmountKobo, input.tenorMonths, input.startDate, outstanding, 'active', ts, ts).run();
    return (await this.findAgreementById(id, input.tenantId))!;
  }

  async findAgreementById(id: string, tenantId: string): Promise<HpAgreement | null> {
    const r = await this.db.prepare('SELECT * FROM hp_agreements WHERE id=? AND tenant_id=?').bind(id, tenantId).first<AgreementRow>();
    return r ? rowToAgreement(r) : null;
  }

  async createRepayment(input: CreateHpRepaymentInput): Promise<HpRepayment> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo < 0) throw new Error('P9: amountKobo must be a non-negative integer');
    const agreement = await this.findAgreementById(input.agreementId, input.tenantId);
    if (!agreement) throw new Error(`Agreement not found: ${input.agreementId}`);
    if (input.amountKobo > agreement.outstandingKobo) throw new Error(`Payment (${input.amountKobo} kobo) exceeds outstanding balance (${agreement.outstandingKobo} kobo)`);
    const outstandingAfter = agreement.outstandingKobo - input.amountKobo;
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO hp_repayments (id,agreement_id,tenant_id,payment_date,amount_kobo,outstanding_after_kobo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id, input.agreementId, input.tenantId, input.paymentDate, input.amountKobo, outstandingAfter, ts, ts).run();
    await this.db.prepare('UPDATE hp_agreements SET outstanding_kobo=?,updated_at=? WHERE id=? AND tenant_id=?').bind(outstandingAfter, ts, input.agreementId, input.tenantId).run();
    return (await this.findRepaymentById(id, input.tenantId))!;
  }

  async findRepaymentById(id: string, tenantId: string): Promise<HpRepayment | null> {
    const r = await this.db.prepare('SELECT * FROM hp_repayments WHERE id=? AND tenant_id=?').bind(id, tenantId).first<RepaymentRow>();
    return r ? rowToRepayment(r) : null;
  }
}
