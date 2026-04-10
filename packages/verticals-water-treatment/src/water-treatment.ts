/**
 * WaterTreatmentRepository — M11
 * T3: all queries scoped to tenantId; P9: kobo integers; litres as integers
 * SCALED INTEGERS: ph_x100, chlorine_ppm10, turbidity_ntu10 — NO floats
 * FSM: seeded → claimed → nafdac_verified → active → suspended
 */

import type {
  WaterTreatmentProfile, WaterQualityLog, WaterSubscription, WaterBilling,
  WaterTreatmentFSMState, PropertyType, PaymentStatus,
  CreateWaterTreatmentInput, CreateWaterQualityLogInput, CreateWaterSubscriptionInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; company_name: string; nafdac_water_licence: string | null; state_water_board_cert: string | null; cac_rc: string | null; capacity_litres_per_day: number; status: string; created_at: number; updated_at: number; }
interface QualityRow { id: string; profile_id: string; tenant_id: string; test_date: number; ph_x100: number; chlorine_ppm10: number; turbidity_ntu10: number; passed_standards: number; created_at: number; updated_at: number; }
interface SubscriptionRow { id: string; profile_id: string; tenant_id: string; client_phone: string; property_type: string; monthly_rate_kobo: number; daily_litres_allocation: number; payment_status: string; created_at: number; updated_at: number; }
interface BillingRow { id: string; subscription_id: string; tenant_id: string; client_phone: string; billing_month: string; volume_supplied_litres: number; billed_kobo: number; paid_kobo: number; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): WaterTreatmentProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, companyName: r.company_name, nafdacWaterLicence: r.nafdac_water_licence, stateWaterBoardCert: r.state_water_board_cert, cacRc: r.cac_rc, capacityLitresPerDay: r.capacity_litres_per_day, status: r.status as WaterTreatmentFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToQuality(r: QualityRow): WaterQualityLog { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, testDate: r.test_date, phX100: r.ph_x100, chlorinePpm10: r.chlorine_ppm10, turbidityNtu10: r.turbidity_ntu10, passedStandards: r.passed_standards === 1, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToSubscription(r: SubscriptionRow): WaterSubscription { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, clientPhone: r.client_phone, propertyType: r.property_type as PropertyType, monthlyRateKobo: r.monthly_rate_kobo, dailyLitresAllocation: r.daily_litres_allocation, paymentStatus: r.payment_status as PaymentStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToBilling(r: BillingRow): WaterBilling { return { id: r.id, subscriptionId: r.subscription_id, tenantId: r.tenant_id, clientPhone: r.client_phone, billingMonth: r.billing_month, volumeSuppliedLitres: r.volume_supplied_litres, billedKobo: r.billed_kobo, paidKobo: r.paid_kobo, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class WaterTreatmentRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateWaterTreatmentInput): Promise<WaterTreatmentProfile> {
    if (!Number.isInteger(input.capacityLitresPerDay) || input.capacityLitresPerDay < 0) throw new Error('capacityLitresPerDay must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO water_treatment_profiles (id,workspace_id,tenant_id,company_name,nafdac_water_licence,state_water_board_cert,cac_rc,capacity_litres_per_day,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.companyName, input.nafdacWaterLicence ?? null, input.stateWaterBoardCert ?? null, input.cacRc ?? null, input.capacityLitresPerDay, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<WaterTreatmentProfile | null> {
    const r = await this.db.prepare('SELECT * FROM water_treatment_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: WaterTreatmentFSMState): Promise<void> {
    await this.db.prepare('UPDATE water_treatment_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createQualityLog(input: CreateWaterQualityLogInput): Promise<WaterQualityLog> {
    if (!Number.isInteger(input.phX100) || input.phX100 < 0 || input.phX100 > 1400) throw new Error('pH must be stored as integer × 100 — no floats; valid range 0–1400');
    if (!Number.isInteger(input.chlorinePpm10) || input.chlorinePpm10 < 0) throw new Error('Chlorine must be stored as integer ppm × 10 — no floats');
    if (!Number.isInteger(input.turbidityNtu10) || input.turbidityNtu10 < 0) throw new Error('Turbidity must be stored as integer NTU × 10 — no floats');
    // WHO standards: pH 650–850, chlorine 2–10 (×10), turbidity ≤10 (×10 ≤100)
    const passed = input.phX100 >= 650 && input.phX100 <= 850 && input.chlorinePpm10 >= 2 && input.chlorinePpm10 <= 20 && input.turbidityNtu10 <= 100;
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO water_quality_log (id,profile_id,tenant_id,test_date,ph_x100,chlorine_ppm10,turbidity_ntu10,passed_standards,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.testDate, input.phX100, input.chlorinePpm10, input.turbidityNtu10, passed ? 1 : 0, ts, ts).run();
    return (await this.findQualityLogById(id, input.tenantId))!;
  }

  async findQualityLogById(id: string, tenantId: string): Promise<WaterQualityLog | null> {
    const r = await this.db.prepare('SELECT * FROM water_quality_log WHERE id=? AND tenant_id=?').bind(id, tenantId).first<QualityRow>();
    return r ? rowToQuality(r) : null;
  }

  async createSubscription(input: CreateWaterSubscriptionInput): Promise<WaterSubscription> {
    if (!Number.isInteger(input.monthlyRateKobo) || input.monthlyRateKobo < 0) throw new Error('P9: monthlyRateKobo must be a non-negative integer');
    if (!Number.isInteger(input.dailyLitresAllocation) || input.dailyLitresAllocation <= 0) throw new Error('dailyLitresAllocation must be a positive integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO water_subscriptions (id,profile_id,tenant_id,client_phone,property_type,monthly_rate_kobo,daily_litres_allocation,payment_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.clientPhone, input.propertyType, input.monthlyRateKobo, input.dailyLitresAllocation, 'active', ts, ts).run();
    return (await this.findSubscriptionById(id, input.tenantId))!;
  }

  async findSubscriptionById(id: string, tenantId: string): Promise<WaterSubscription | null> {
    const r = await this.db.prepare('SELECT * FROM water_subscriptions WHERE id=? AND tenant_id=?').bind(id, tenantId).first<SubscriptionRow>();
    return r ? rowToSubscription(r) : null;
  }
}
