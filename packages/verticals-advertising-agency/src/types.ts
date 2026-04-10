/**
 * @webwaka/verticals-advertising-agency — types + FSM guards (M9)
 * FSM: seeded → claimed → apcon_verified → active → suspended
 * AI: L2 cap — campaign performance (aggregate impressions and CPM trend); no client_ref_id or creative brief to AI (P13)
 * P9: all monetary values in kobo integers; impressions INTEGER; CPM in kobo INTEGER
 * P13: client_ref_id opaque; creative briefs NEVER to AI
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 for campaign billing; Tier 3 for media buys above ₦50M
 */

export type AdvertisingAgencyFSMState =
  | 'seeded'
  | 'claimed'
  | 'apcon_verified'
  | 'active'
  | 'suspended';

export type CampaignType = 'digital' | 'OOH' | 'TV' | 'radio' | 'print';
export type CampaignStatus = 'planning' | 'active' | 'completed';
export type AdBillingPeriod = string; // YYYY-MM

const FSM_TRANSITIONS: Record<AdvertisingAgencyFSMState, AdvertisingAgencyFSMState[]> = {
  seeded:        ['claimed'],
  claimed:       ['apcon_verified'],
  apcon_verified: ['active'],
  active:        ['suspended'],
  suspended:     ['active'],
};

export function isValidAdvertisingAgencyTransition(from: AdvertisingAgencyFSMState, to: AdvertisingAgencyFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToApconVerified(input: { apconRegistration: string | null }): GuardResult {
  if (!input.apconRegistration || input.apconRegistration.trim() === '') {
    return { allowed: false, reason: 'APCON registration required to verify advertising agency' };
  }
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'Advertising agency AI capped at L2 advisory — campaign performance aggregate only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'Advertising agency AI capped at L2' };
  }
  return { allowed: true };
}

export function guardNoClientBriefInAi(payload: Record<string, unknown>): GuardResult {
  const forbidden = ['client_ref_id', 'clientRefId', 'creative_brief', 'creativeBrief', 'campaign_strategy'];
  for (const key of forbidden) {
    if (key in payload) return { allowed: false, reason: `P13: client/brief data "${key}" must not pass to AI` };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export function guardIntegerImpressions(n: number): GuardResult {
  if (!Number.isInteger(n) || n < 0) return { allowed: false, reason: 'impressions must be a non-negative integer' };
  return { allowed: true };
}

export interface AdvertisingAgencyProfile {
  id: string; workspaceId: string; tenantId: string;
  agencyName: string; apconRegistration: string | null;
  oaanMembership: string | null; cacRc: string | null;
  status: AdvertisingAgencyFSMState; createdAt: number; updatedAt: number;
}

export interface AdCampaign {
  id: string; profileId: string; tenantId: string;
  clientRefId: string; campaignName: string; campaignType: CampaignType;
  budgetKobo: number; startDate: number; endDate: number;
  status: CampaignStatus; createdAt: number; updatedAt: number;
}

export interface AdMediaBuy {
  id: string; campaignId: string; tenantId: string;
  channel: string; spendKobo: number; impressions: number; cpmKobo: number;
  createdAt: number; updatedAt: number;
}

export interface AdBilling {
  id: string; profileId: string; tenantId: string;
  clientRefId: string; period: string;
  mediaSpendKobo: number; agencyCommissionKobo: number; retainerKobo: number; totalBilledKobo: number;
  createdAt: number; updatedAt: number;
}

export interface CreateAdvertisingAgencyInput {
  id?: string; workspaceId: string; tenantId: string;
  agencyName: string; apconRegistration?: string; oaanMembership?: string; cacRc?: string;
}

export interface CreateAdCampaignInput {
  id?: string; profileId: string; tenantId: string;
  clientRefId: string; campaignName: string; campaignType: CampaignType;
  budgetKobo: number; startDate: number; endDate: number;
}

export interface CreateAdMediaBuyInput {
  id?: string; campaignId: string; tenantId: string;
  channel: string; spendKobo: number; impressions: number; cpmKobo: number;
}
