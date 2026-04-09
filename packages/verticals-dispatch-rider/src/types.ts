/**
 * @webwaka/verticals-dispatch-rider — Domain types
 * M9 Transport Extended — Task V-TRN-EXT-3
 *
 * FSM: seeded → claimed → frsc_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:         KYC Tier 1
 *   claimed → frsc_verified:  FRSC licence + VIO cert required; KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: rider names, plates, FRSC numbers never passed to AI layer
 */

export type DispatchRiderFSMState =
  | 'seeded'
  | 'claimed'
  | 'frsc_verified'
  | 'active'
  | 'suspended';

export type JobStatus =
  | 'created'
  | 'assigned'
  | 'picked_up'
  | 'delivered'
  | 'cod_collected';

export type RiderAvailability = 'active' | 'suspended' | 'offline';

export interface DispatchRiderProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  cacRc: string | null;
  status: DispatchRiderFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDispatchRiderProfileInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  cacRc?: string | undefined;
}

export interface UpdateDispatchRiderProfileInput {
  companyName?: string | undefined;
  cacRc?: string | null | undefined;
  status?: DispatchRiderFSMState | undefined;
}

export interface DispatchRider {
  id: string;
  profileId: string;
  tenantId: string;
  riderName: string;
  phone: string | null;
  frscLicence: string | null;
  vioCert: string | null;
  vehiclePlate: string | null;
  commissionPct: number;
  status: RiderAvailability;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDispatchRiderInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  riderName: string;
  phone?: string | undefined;
  frscLicence?: string | undefined;
  vioCert?: string | undefined;
  vehiclePlate?: string | undefined;
  commissionPct?: number | undefined;
}

export interface DispatchJob {
  id: string;
  profileId: string;
  tenantId: string;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  packageDescription: string | null;
  feeKobo: number;
  codAmountKobo: number;
  riderId: string | null;
  customerPhone: string | null;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDispatchJobInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  pickupAddress?: string | undefined;
  dropoffAddress?: string | undefined;
  packageDescription?: string | undefined;
  feeKobo: number;
  codAmountKobo?: number | undefined;
  customerPhone?: string | undefined;
}

export interface RiderEarning {
  id: string;
  riderId: string;
  jobId: string;
  tenantId: string;
  grossFeeKobo: number;
  commissionKobo: number;
  netPayoutKobo: number;
  payoutDate: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRiderEarningInput {
  id?: string | undefined;
  riderId: string;
  jobId: string;
  tenantId: string;
  grossFeeKobo: number;
  commissionKobo: number;
  netPayoutKobo: number;
  payoutDate?: number | undefined;
}

export const VALID_DISPATCH_RIDER_TRANSITIONS: Record<DispatchRiderFSMState, DispatchRiderFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['frsc_verified', 'suspended'],
  frsc_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidDispatchRiderTransition(from: DispatchRiderFSMState, to: DispatchRiderFSMState): boolean {
  return VALID_DISPATCH_RIDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim dispatch rider profile' };
  return { allowed: true };
}

export function guardClaimedToFrscVerified(ctx: { frscLicenceOnFile: boolean; kycTier: number }): { allowed: boolean; reason?: string } {
  if (!ctx.frscLicenceOnFile) return { allowed: false, reason: 'FRSC licence required for frsc_verified transition' };
  if (ctx.kycTier < 2) return { allowed: false, reason: 'KYC Tier 2 required for frsc_verified transition' };
  return { allowed: true };
}
