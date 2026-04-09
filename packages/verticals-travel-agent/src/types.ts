/**
 * @webwaka/verticals-travel-agent — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B11
 *
 * FSM: seeded → claimed → nanta_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   Domestic tour packages: KYC Tier 2
 *   FX holiday / ticket issuance: KYC Tier 3
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: No client passport or personal travel details passed to AI
 */

export type TravelAgentFSMState =
  | 'seeded'
  | 'claimed'
  | 'nanta_verified'
  | 'active'
  | 'suspended';

export type TravelPackageType = 'holiday' | 'hajj' | 'umrah' | 'corporate' | 'domestic';
export type VisaStatus = 'not_required' | 'applied' | 'approved' | 'rejected';
export type BookingStatus = 'enquiry' | 'confirmed' | 'paid' | 'departed' | 'completed';

export interface TravelAgentProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  agencyName: string;
  nantaNumber: string | null;
  iataCode: string | null;
  cacRc: string | null;
  status: TravelAgentFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTravelAgentInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  agencyName: string;
  nantaNumber?: string | undefined;
  iataCode?: string | undefined;
  cacRc?: string | undefined;
}

export interface UpdateTravelAgentInput {
  agencyName?: string | undefined;
  nantaNumber?: string | null | undefined;
  iataCode?: string | null | undefined;
  cacRc?: string | null | undefined;
  status?: TravelAgentFSMState | undefined;
}

export interface TravelPackage {
  id: string;
  workspaceId: string;
  tenantId: string;
  packageName: string;
  destination: string;
  type: TravelPackageType;
  durationDays: number;
  pricePerPaxKobo: number;
  inclusions: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTravelPackageInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  packageName: string;
  destination: string;
  type: TravelPackageType;
  durationDays?: number | undefined;
  pricePerPaxKobo: number;
  inclusions?: string | undefined;
}

export interface TravelBooking {
  id: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  packageId: string;
  travelDate: number;
  paxCount: number;
  totalKobo: number;
  depositKobo: number;
  balanceKobo: number;
  visaStatus: VisaStatus;
  status: BookingStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTravelBookingInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  packageId: string;
  travelDate: number;
  paxCount?: number | undefined;
  totalKobo: number;
  depositKobo: number;
  balanceKobo: number;
  visaStatus?: VisaStatus | undefined;
}

export const VALID_TRAVEL_AGENT_TRANSITIONS: Record<TravelAgentFSMState, TravelAgentFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['nanta_verified', 'suspended'],
  nanta_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidTravelAgentTransition(from: TravelAgentFSMState, to: TravelAgentFSMState): boolean {
  return VALID_TRAVEL_AGENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim travel agent profile' };
  return { allowed: true };
}

export function guardClaimedToNantaVerified(ctx: { nantaNumber: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.nantaNumber) return { allowed: false, reason: 'NANTA number required for nanta_verified transition' };
  return { allowed: true };
}
