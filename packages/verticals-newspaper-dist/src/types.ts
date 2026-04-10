/**
 * @webwaka/verticals-newspaper-dist — types + FSM guards (M12)
 * FSM: seeded → claimed → npc_verified → active → suspended
 * AI: L2 cap — ad revenue trend + circulation trend (aggregate only); no vendor/advertiser details to AI (P13)
 * P9: all monetary values in kobo integers; print_run INTEGER copies; copies_returned INTEGER
 * P13: advertiser_ref_id opaque
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 for vendor credit and ad billing; Tier 3 for government contract ads above ₦5M
 */

export type NewspaperDistFSMState =
  | 'seeded'
  | 'claimed'
  | 'npc_verified'
  | 'active'
  | 'suspended';

export type Frequency = 'daily' | 'weekly' | 'monthly';
export type AdType = 'front_page' | 'full_page' | 'classifieds';
export type AdStatus = 'booked' | 'published' | 'invoiced' | 'paid';

const FSM_TRANSITIONS: Record<NewspaperDistFSMState, NewspaperDistFSMState[]> = {
  seeded:      ['claimed'],
  claimed:     ['npc_verified'],
  npc_verified: ['active'],
  active:      ['suspended'],
  suspended:   ['active'],
};

export function isValidNewspaperDistTransition(from: NewspaperDistFSMState, to: NewspaperDistFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToNpcVerified(input: { npcRegistration: string | null }): GuardResult {
  if (!input.npcRegistration || input.npcRegistration.trim() === '') {
    return { allowed: false, reason: 'NPC registration required to verify newspaper/media house' };
  }
  return { allowed: true };
}

export function guardIntegerPrintRun(n: number): GuardResult {
  if (!Number.isInteger(n) || n <= 0) return { allowed: false, reason: 'print_run must be a positive integer (copies)' };
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'Newspaper distribution AI capped at L2 advisory — circulation and revenue aggregate only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'Newspaper distribution AI capped at L2' };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface NewspaperDistProfile {
  id: string; workspaceId: string; tenantId: string;
  publicationName: string; npcRegistration: string | null;
  npanMembership: string | null; nujAffiliation: string | null; frequency: Frequency;
  status: NewspaperDistFSMState; createdAt: number; updatedAt: number;
}

export interface NewspaperPrintRun {
  id: string; profileId: string; tenantId: string;
  editionDate: number; printRun: number; distributionCount: number;
  copiesReturned: number; costPerCopyKobo: number;
  createdAt: number; updatedAt: number;
}

export interface NewspaperVendor {
  id: string; profileId: string; tenantId: string;
  vendorPhone: string; vendorName: string;
  creditLimitKobo: number; balanceOwingKobo: number;
  createdAt: number; updatedAt: number;
}

export interface NewspaperAd {
  id: string; profileId: string; tenantId: string;
  advertiserRefId: string; editionDate: number;
  adType: AdType; adFeeKobo: number; status: AdStatus;
  createdAt: number; updatedAt: number;
}

export interface CreateNewspaperDistInput {
  id?: string; workspaceId: string; tenantId: string;
  publicationName: string; npcRegistration?: string;
  npanMembership?: string; nujAffiliation?: string; frequency: Frequency;
}

export interface CreateNewspaperPrintRunInput {
  id?: string; profileId: string; tenantId: string;
  editionDate: number; printRun: number; distributionCount: number;
  copiesReturned: number; costPerCopyKobo: number;
}

export interface CreateNewspaperAdInput {
  id?: string; profileId: string; tenantId: string;
  advertiserRefId: string; editionDate: number; adType: AdType; adFeeKobo: number;
}
