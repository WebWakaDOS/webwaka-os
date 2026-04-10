/**
 * NewspaperDistRepository — M12
 * T3: all queries scoped to tenantId; P9: all monetary in kobo; print_run INTEGER copies
 * advertiser_ref_id opaque (P13)
 * FSM: seeded → claimed → npc_verified → active → suspended
 */

import type {
  NewspaperDistProfile, NewspaperPrintRun, NewspaperVendor, NewspaperAd,
  NewspaperDistFSMState, Frequency, AdType, AdStatus,
  CreateNewspaperDistInput, CreateNewspaperPrintRunInput, CreateNewspaperAdInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; publication_name: string; npc_registration: string | null; npan_membership: string | null; nuj_affiliation: string | null; frequency: string; status: string; created_at: number; updated_at: number; }
interface PrintRunRow { id: string; profile_id: string; tenant_id: string; edition_date: number; print_run: number; distribution_count: number; copies_returned: number; cost_per_copy_kobo: number; created_at: number; updated_at: number; }
interface VendorRow { id: string; profile_id: string; tenant_id: string; vendor_phone: string; vendor_name: string; credit_limit_kobo: number; balance_owing_kobo: number; created_at: number; updated_at: number; }
interface AdRow { id: string; profile_id: string; tenant_id: string; advertiser_ref_id: string; edition_date: number; ad_type: string; ad_fee_kobo: number; status: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): NewspaperDistProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, publicationName: r.publication_name, npcRegistration: r.npc_registration, npanMembership: r.npan_membership, nujAffiliation: r.nuj_affiliation, frequency: r.frequency as Frequency, status: r.status as NewspaperDistFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToPrintRun(r: PrintRunRow): NewspaperPrintRun { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, editionDate: r.edition_date, printRun: r.print_run, distributionCount: r.distribution_count, copiesReturned: r.copies_returned, costPerCopyKobo: r.cost_per_copy_kobo, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToVendor(r: VendorRow): NewspaperVendor { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, vendorPhone: r.vendor_phone, vendorName: r.vendor_name, creditLimitKobo: r.credit_limit_kobo, balanceOwingKobo: r.balance_owing_kobo, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToAd(r: AdRow): NewspaperAd { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, advertiserRefId: r.advertiser_ref_id, editionDate: r.edition_date, adType: r.ad_type as AdType, adFeeKobo: r.ad_fee_kobo, status: r.status as AdStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class NewspaperDistRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateNewspaperDistInput): Promise<NewspaperDistProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO newspaper_dist_profiles (id,workspace_id,tenant_id,publication_name,npc_registration,npan_membership,nuj_affiliation,frequency,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.publicationName, input.npcRegistration ?? null, input.npanMembership ?? null, input.nujAffiliation ?? null, input.frequency, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<NewspaperDistProfile | null> {
    const r = await this.db.prepare('SELECT * FROM newspaper_dist_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: NewspaperDistFSMState): Promise<void> {
    await this.db.prepare('UPDATE newspaper_dist_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createPrintRun(input: CreateNewspaperPrintRunInput): Promise<NewspaperPrintRun> {
    if (!Number.isInteger(input.printRun) || input.printRun <= 0) throw new Error('printRun must be a positive integer (copies count)');
    if (!Number.isInteger(input.copiesReturned) || input.copiesReturned < 0) throw new Error('copiesReturned must be a non-negative integer');
    if (!Number.isInteger(input.costPerCopyKobo) || input.costPerCopyKobo < 0) throw new Error('P9: costPerCopyKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO newspaper_print_runs (id,profile_id,tenant_id,edition_date,print_run,distribution_count,copies_returned,cost_per_copy_kobo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.editionDate, input.printRun, input.distributionCount, input.copiesReturned, input.costPerCopyKobo, ts, ts).run();
    return (await this.findPrintRunById(id, input.tenantId))!;
  }

  async findPrintRunById(id: string, tenantId: string): Promise<NewspaperPrintRun | null> {
    const r = await this.db.prepare('SELECT * FROM newspaper_print_runs WHERE id=? AND tenant_id=?').bind(id, tenantId).first<PrintRunRow>();
    return r ? rowToPrintRun(r) : null;
  }

  async createAd(input: CreateNewspaperAdInput): Promise<NewspaperAd> {
    if (!Number.isInteger(input.adFeeKobo) || input.adFeeKobo < 0) throw new Error('P9: adFeeKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO newspaper_ads (id,profile_id,tenant_id,advertiser_ref_id,edition_date,ad_type,ad_fee_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.advertiserRefId, input.editionDate, input.adType, input.adFeeKobo, 'booked', ts, ts).run();
    return (await this.findAdById(id, input.tenantId))!;
  }

  async findAdById(id: string, tenantId: string): Promise<NewspaperAd | null> {
    const r = await this.db.prepare('SELECT * FROM newspaper_ads WHERE id=? AND tenant_id=?').bind(id, tenantId).first<AdRow>();
    return r ? rowToAd(r) : null;
  }
}
