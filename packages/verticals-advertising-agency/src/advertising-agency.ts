/**
 * AdvertisingAgencyRepository — M9
 * T3: all queries scoped to tenantId; P9: all monetary in kobo; impressions INTEGER; CPM INTEGER
 * client_ref_id opaque (P13); creative briefs never stored or forwarded to AI
 * FSM: seeded → claimed → apcon_verified → active → suspended
 */

import type {
  AdvertisingAgencyProfile, AdCampaign, AdMediaBuy, AdBilling,
  AdvertisingAgencyFSMState, CampaignType, CampaignStatus,
  CreateAdvertisingAgencyInput, CreateAdCampaignInput, CreateAdMediaBuyInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; agency_name: string; apcon_registration: string | null; oaan_membership: string | null; cac_rc: string | null; status: string; created_at: number; updated_at: number; }
interface CampaignRow { id: string; profile_id: string; tenant_id: string; client_ref_id: string; campaign_name: string; campaign_type: string; budget_kobo: number; start_date: number; end_date: number; status: string; created_at: number; updated_at: number; }
interface MediaBuyRow { id: string; campaign_id: string; tenant_id: string; channel: string; spend_kobo: number; impressions: number; cpm_kobo: number; created_at: number; updated_at: number; }
interface BillingRow { id: string; profile_id: string; tenant_id: string; client_ref_id: string; period: string; media_spend_kobo: number; agency_commission_kobo: number; retainer_kobo: number; total_billed_kobo: number; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): AdvertisingAgencyProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, agencyName: r.agency_name, apconRegistration: r.apcon_registration, oaanMembership: r.oaan_membership, cacRc: r.cac_rc, status: r.status as AdvertisingAgencyFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToCampaign(r: CampaignRow): AdCampaign { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, clientRefId: r.client_ref_id, campaignName: r.campaign_name, campaignType: r.campaign_type as CampaignType, budgetKobo: r.budget_kobo, startDate: r.start_date, endDate: r.end_date, status: r.status as CampaignStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToMediaBuy(r: MediaBuyRow): AdMediaBuy { return { id: r.id, campaignId: r.campaign_id, tenantId: r.tenant_id, channel: r.channel, spendKobo: r.spend_kobo, impressions: r.impressions, cpmKobo: r.cpm_kobo, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToBilling(r: BillingRow): AdBilling { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, clientRefId: r.client_ref_id, period: r.period, mediaSpendKobo: r.media_spend_kobo, agencyCommissionKobo: r.agency_commission_kobo, retainerKobo: r.retainer_kobo, totalBilledKobo: r.total_billed_kobo, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class AdvertisingAgencyRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateAdvertisingAgencyInput): Promise<AdvertisingAgencyProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO advertising_agency_profiles (id,workspace_id,tenant_id,agency_name,apcon_registration,oaan_membership,cac_rc,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.agencyName, input.apconRegistration ?? null, input.oaanMembership ?? null, input.cacRc ?? null, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<AdvertisingAgencyProfile | null> {
    const r = await this.db.prepare('SELECT * FROM advertising_agency_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: AdvertisingAgencyFSMState): Promise<void> {
    await this.db.prepare('UPDATE advertising_agency_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createCampaign(input: CreateAdCampaignInput): Promise<AdCampaign> {
    if (!Number.isInteger(input.budgetKobo) || input.budgetKobo < 0) throw new Error('P9: budgetKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO ad_campaigns (id,profile_id,tenant_id,client_ref_id,campaign_name,campaign_type,budget_kobo,start_date,end_date,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.clientRefId, input.campaignName, input.campaignType, input.budgetKobo, input.startDate, input.endDate, 'planning', ts, ts).run();
    return (await this.findCampaignById(id, input.tenantId))!;
  }

  async findCampaignById(id: string, tenantId: string): Promise<AdCampaign | null> {
    const r = await this.db.prepare('SELECT * FROM ad_campaigns WHERE id=? AND tenant_id=?').bind(id, tenantId).first<CampaignRow>();
    return r ? rowToCampaign(r) : null;
  }

  async createMediaBuy(input: CreateAdMediaBuyInput): Promise<AdMediaBuy> {
    if (!Number.isInteger(input.spendKobo) || input.spendKobo < 0) throw new Error('P9: spendKobo must be a non-negative integer');
    if (!Number.isInteger(input.impressions) || input.impressions < 0) throw new Error('impressions must be a non-negative integer');
    if (!Number.isInteger(input.cpmKobo) || input.cpmKobo < 0) throw new Error('P9: cpmKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO ad_media_buys (id,campaign_id,tenant_id,channel,spend_kobo,impressions,cpm_kobo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.campaignId, input.tenantId, input.channel, input.spendKobo, input.impressions, input.cpmKobo, ts, ts).run();
    return (await this.findMediaBuyById(id, input.tenantId))!;
  }

  async findMediaBuyById(id: string, tenantId: string): Promise<AdMediaBuy | null> {
    const r = await this.db.prepare('SELECT * FROM ad_media_buys WHERE id=? AND tenant_id=?').bind(id, tenantId).first<MediaBuyRow>();
    return r ? rowToMediaBuy(r) : null;
  }
}
