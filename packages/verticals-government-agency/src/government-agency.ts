/**
 * GovernmentAgencyRepository — M11
 * T3: all queries scoped to tenantId; P9: all monetary in kobo
 * L3 HITL MANDATORY on ALL AI — enforced at route level (not repo layer)
 * vendor_ref opaque (P13)
 * FSM: seeded → claimed → bpp_registered → active → suspended
 */

import type {
  GovernmentAgencyProfile, MdaAppropriation, MdaProcurement, MdaIgrCollection,
  GovernmentAgencyFSMState, ProcurementCategory, ProcurementStatus,
  CreateGovernmentAgencyInput, CreateMdaAppropriationInput, CreateMdaProcurementInput, CreateMdaIgrCollectionInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; agency_name: string; mda_code: string | null; bpp_registration: string | null; tsa_compliance: number; state: string; ministry: string | null; status: string; created_at: number; updated_at: number; }
interface AppropriationRow { id: string; profile_id: string; tenant_id: string; fiscal_year: string; budget_line_item: string; allocated_kobo: number; released_kobo: number; spent_kobo: number; created_at: number; updated_at: number; }
interface ProcurementRow { id: string; profile_id: string; tenant_id: string; procurement_ref: string; bpp_approval_ref: string | null; vendor_ref: string; amount_kobo: number; category: string; status: string; created_at: number; updated_at: number; }
interface IgrRow { id: string; profile_id: string; tenant_id: string; revenue_type: string; collection_date: number; amount_kobo: number; receipt_ref: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): GovernmentAgencyProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, agencyName: r.agency_name, mdaCode: r.mda_code, bppRegistration: r.bpp_registration, tsaCompliance: r.tsa_compliance === 1, state: r.state, ministry: r.ministry, status: r.status as GovernmentAgencyFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToAppropriation(r: AppropriationRow): MdaAppropriation { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, fiscalYear: r.fiscal_year, budgetLineItem: r.budget_line_item, allocatedKobo: r.allocated_kobo, releasedKobo: r.released_kobo, spentKobo: r.spent_kobo, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToProcurement(r: ProcurementRow): MdaProcurement { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, procurementRef: r.procurement_ref, bppApprovalRef: r.bpp_approval_ref, vendorRef: r.vendor_ref, amountKobo: r.amount_kobo, category: r.category as ProcurementCategory, status: r.status as ProcurementStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToIgr(r: IgrRow): MdaIgrCollection { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, revenueType: r.revenue_type, collectionDate: r.collection_date, amountKobo: r.amount_kobo, receiptRef: r.receipt_ref, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class GovernmentAgencyRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateGovernmentAgencyInput): Promise<GovernmentAgencyProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO government_agency_profiles (id,workspace_id,tenant_id,agency_name,mda_code,bpp_registration,tsa_compliance,state,ministry,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.agencyName, input.mdaCode ?? null, input.bppRegistration ?? null, input.tsaCompliance ? 1 : 0, input.state, input.ministry ?? null, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<GovernmentAgencyProfile | null> {
    const r = await this.db.prepare('SELECT * FROM government_agency_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: GovernmentAgencyFSMState): Promise<void> {
    await this.db.prepare('UPDATE government_agency_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createAppropriation(input: CreateMdaAppropriationInput): Promise<MdaAppropriation> {
    if (!Number.isInteger(input.allocatedKobo) || input.allocatedKobo < 0) throw new Error('P9: allocatedKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO mda_appropriations (id,profile_id,tenant_id,fiscal_year,budget_line_item,allocated_kobo,released_kobo,spent_kobo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.fiscalYear, input.budgetLineItem, input.allocatedKobo, input.releasedKobo ?? 0, input.spentKobo ?? 0, ts, ts).run();
    return (await this.findAppropriationById(id, input.tenantId))!;
  }

  async findAppropriationById(id: string, tenantId: string): Promise<MdaAppropriation | null> {
    const r = await this.db.prepare('SELECT * FROM mda_appropriations WHERE id=? AND tenant_id=?').bind(id, tenantId).first<AppropriationRow>();
    return r ? rowToAppropriation(r) : null;
  }

  async createProcurement(input: CreateMdaProcurementInput): Promise<MdaProcurement> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo < 0) throw new Error('P9: amountKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO mda_procurements (id,profile_id,tenant_id,procurement_ref,bpp_approval_ref,vendor_ref,amount_kobo,category,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.procurementRef, input.bppApprovalRef ?? null, input.vendorRef, input.amountKobo, input.category, 'open', ts, ts).run();
    return (await this.findProcurementById(id, input.tenantId))!;
  }

  async findProcurementById(id: string, tenantId: string): Promise<MdaProcurement | null> {
    const r = await this.db.prepare('SELECT * FROM mda_procurements WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProcurementRow>();
    return r ? rowToProcurement(r) : null;
  }

  async createIgrCollection(input: CreateMdaIgrCollectionInput): Promise<MdaIgrCollection> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo < 0) throw new Error('P9: amountKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO mda_igr_collections (id,profile_id,tenant_id,revenue_type,collection_date,amount_kobo,receipt_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.revenueType, input.collectionDate, input.amountKobo, input.receiptRef, ts, ts).run();
    return (await this.findIgrById(id, input.tenantId))!;
  }

  async findIgrById(id: string, tenantId: string): Promise<MdaIgrCollection | null> {
    const r = await this.db.prepare('SELECT * FROM mda_igr_collections WHERE id=? AND tenant_id=?').bind(id, tenantId).first<IgrRow>();
    return r ? rowToIgr(r) : null;
  }
}
