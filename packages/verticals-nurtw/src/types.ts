/**
 * @webwaka/verticals-nurtw — Domain types
 * M12 Transport Extended — Task V-TRN-EXT-8
 *
 * FSM: seeded → claimed → nurtw_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:         KYC Tier 1
 *   claimed → nurtw_verified: NURTW registration required; KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * AI: L3 HITL for any output referencing membership or leadership (politically sensitive)
 * P13: member names, vehicle plates never passed to AI layer
 */

export type NurtwFSMState =
  | 'seeded'
  | 'claimed'
  | 'nurtw_verified'
  | 'active'
  | 'suspended';

export type ChapterLevel = 'national' | 'state' | 'lga' | 'park';
export type DuesStatus = 'current' | 'arrears';
export type WelfareClaimType = 'accident' | 'medical' | 'death_benefit';
export type WelfareClaimStatus = 'submitted' | 'approved' | 'paid' | 'rejected';

export interface NurtwProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  unionName: string;
  chapterLevel: ChapterLevel;
  nurtwRegistration: string | null;
  state: string | null;
  status: NurtwFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateNurtwInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  unionName: string;
  chapterLevel?: ChapterLevel | undefined;
  nurtwRegistration?: string | undefined;
  state?: string | undefined;
}

export interface UpdateNurtwInput {
  unionName?: string | undefined;
  chapterLevel?: ChapterLevel | undefined;
  nurtwRegistration?: string | null | undefined;
  state?: string | null | undefined;
  status?: NurtwFSMState | undefined;
}

export interface UnionMember {
  id: string;
  profileId: string;
  tenantId: string;
  memberName: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  memberSince: number | null;
  monthlyDuesKobo: number;
  duesStatus: DuesStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateUnionMemberInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  memberName: string;
  vehiclePlate?: string | undefined;
  vehicleType?: string | undefined;
  memberSince?: number | undefined;
  monthlyDuesKobo: number;
}

export interface UnionDuesLog {
  id: string;
  memberId: string;
  profileId: string;
  tenantId: string;
  collectionDate: number | null;
  amountKobo: number;
  collectorId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateUnionDuesLogInput {
  id?: string | undefined;
  memberId: string;
  profileId: string;
  tenantId: string;
  collectionDate?: number | undefined;
  amountKobo: number;
  collectorId?: string | undefined;
}

export interface UnionWelfareClaim {
  id: string;
  memberId: string;
  profileId: string;
  tenantId: string;
  claimType: WelfareClaimType;
  amountKobo: number;
  status: WelfareClaimStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWelfareClaimInput {
  id?: string | undefined;
  memberId: string;
  profileId: string;
  tenantId: string;
  claimType?: WelfareClaimType | undefined;
  amountKobo: number;
}

export const VALID_NURTW_TRANSITIONS: Record<NurtwFSMState, NurtwFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['nurtw_verified', 'suspended'],
  nurtw_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidNurtwTransition(from: NurtwFSMState, to: NurtwFSMState): boolean {
  return VALID_NURTW_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim NURTW profile' };
  return { allowed: true };
}

export function guardClaimedToNurtwVerified(ctx: { nurtwRegistration: string | null; kycTier: number }): { allowed: boolean; reason?: string } {
  if (!ctx.nurtwRegistration) return { allowed: false, reason: 'NURTW registration required for nurtw_verified transition' };
  if (ctx.kycTier < 2) return { allowed: false, reason: 'KYC Tier 2 required for nurtw_verified transition' };
  return { allowed: true };
}
