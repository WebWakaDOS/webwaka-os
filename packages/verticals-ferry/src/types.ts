/**
 * @webwaka/verticals-ferry — Domain types
 * M12 Transport Extended — Task V-TRN-EXT-7
 *
 * FSM: seeded → claimed → nimasa_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:          KYC Tier 1
 *   claimed → nimasa_verified: NIMASA licence required; KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: individual passenger data never passed to AI layer
 */

export type FerryFSMState =
  | 'seeded'
  | 'claimed'
  | 'nimasa_verified'
  | 'active'
  | 'suspended';

export type VesselType = 'speedboat' | 'ferry' | 'boat';
export type VesselStatus = 'operational' | 'maintenance' | 'decommissioned';
export type TripStatus = 'scheduled' | 'departed' | 'arrived' | 'cancelled';

export interface FerryOperatorProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  nimasaLicence: string | null;
  nrcCompliance: boolean;
  cacRc: string | null;
  status: FerryFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateFerryProfileInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  nimasaLicence?: string | undefined;
  nrcCompliance?: boolean | undefined;
  cacRc?: string | undefined;
}

export interface UpdateFerryProfileInput {
  companyName?: string | undefined;
  nimasaLicence?: string | null | undefined;
  nrcCompliance?: boolean | undefined;
  cacRc?: string | null | undefined;
  status?: FerryFSMState | undefined;
}

export interface FerryVessel {
  id: string;
  profileId: string;
  tenantId: string;
  vesselName: string;
  type: VesselType;
  capacityPassengers: number;
  nimasaReg: string | null;
  routeDescription: string | null;
  status: VesselStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateFerryVesselInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  vesselName: string;
  type?: VesselType | undefined;
  capacityPassengers: number;
  nimasaReg?: string | undefined;
  routeDescription?: string | undefined;
}

export interface FerryTrip {
  id: string;
  vesselId: string;
  profileId: string;
  tenantId: string;
  route: string | null;
  departureTime: number | null;
  arrivalTime: number | null;
  passengerCount: number;
  ticketPriceKobo: number;
  totalRevenueKobo: number;
  status: TripStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateFerryTripInput {
  id?: string | undefined;
  vesselId: string;
  profileId: string;
  tenantId: string;
  route?: string | undefined;
  departureTime?: number | undefined;
  passengerCount: number;
  ticketPriceKobo: number;
  totalRevenueKobo: number;
}

export const VALID_FERRY_TRANSITIONS: Record<FerryFSMState, FerryFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['nimasa_verified', 'suspended'],
  nimasa_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidFerryTransition(from: FerryFSMState, to: FerryFSMState): boolean {
  return VALID_FERRY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim ferry profile' };
  return { allowed: true };
}

export function guardClaimedToNimasaVerified(ctx: { nimasaLicence: string | null; kycTier: number }): { allowed: boolean; reason?: string } {
  if (!ctx.nimasaLicence) return { allowed: false, reason: 'NIMASA licence required for nimasa_verified transition' };
  if (ctx.kycTier < 2) return { allowed: false, reason: 'KYC Tier 2 required for nimasa_verified transition' };
  return { allowed: true };
}
