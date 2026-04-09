/**
 * @webwaka/verticals-cargo-truck — Domain types
 * M12 Transport Extended — Task V-TRN-EXT-5
 *
 * FSM: seeded → claimed → frsc_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:        KYC Tier 1
 *   claimed → frsc_verified: FRSC operator licence required; KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: client_phone, client names never passed to AI layer
 */

export type CargoTruckFSMState =
  | 'seeded'
  | 'claimed'
  | 'frsc_verified'
  | 'active'
  | 'suspended';

export type TruckStatus = 'available' | 'on_trip' | 'maintenance';
export type TripStatus = 'loading' | 'in_transit' | 'delivered' | 'paid';
export type ExpenseType = 'fuel' | 'maintenance' | 'levy' | 'toll';

export interface CargoTruckProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  cacOrCoopNumber: string | null;
  frscOperatorLicence: string | null;
  status: CargoTruckFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCargoTruckProfileInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  cacOrCoopNumber?: string | undefined;
  frscOperatorLicence?: string | undefined;
}

export interface UpdateCargoTruckProfileInput {
  companyName?: string | undefined;
  cacOrCoopNumber?: string | null | undefined;
  frscOperatorLicence?: string | null | undefined;
  status?: CargoTruckFSMState | undefined;
}

export interface CargoTruck {
  id: string;
  profileId: string;
  tenantId: string;
  plate: string;
  make: string | null;
  model: string | null;
  tonnageKg: number;
  frscCertExpiry: number | null;
  status: TruckStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCargoTruckInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  plate: string;
  make?: string | undefined;
  model?: string | undefined;
  tonnageKg: number;
  frscCertExpiry?: number | undefined;
}

export interface CargoTrip {
  id: string;
  truckId: string;
  profileId: string;
  tenantId: string;
  origin: string | null;
  destination: string | null;
  cargoDescription: string | null;
  cargoWeightKg: number;
  hireRateKobo: number;
  clientPhone: string | null;
  departureDate: number | null;
  arrivalDate: number | null;
  status: TripStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCargoTripInput {
  id?: string | undefined;
  truckId: string;
  profileId: string;
  tenantId: string;
  origin?: string | undefined;
  destination?: string | undefined;
  cargoDescription?: string | undefined;
  cargoWeightKg: number;
  hireRateKobo: number;
  clientPhone?: string | undefined;
  departureDate?: number | undefined;
}

export interface TruckExpense {
  id: string;
  truckId: string;
  tenantId: string;
  expenseType: ExpenseType;
  amountKobo: number;
  expenseDate: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTruckExpenseInput {
  id?: string | undefined;
  truckId: string;
  tenantId: string;
  expenseType?: ExpenseType | undefined;
  amountKobo: number;
  expenseDate?: number | undefined;
}

export const VALID_CARGO_TRUCK_TRANSITIONS: Record<CargoTruckFSMState, CargoTruckFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['frsc_verified', 'suspended'],
  frsc_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidCargoTruckTransition(from: CargoTruckFSMState, to: CargoTruckFSMState): boolean {
  return VALID_CARGO_TRUCK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim cargo truck profile' };
  return { allowed: true };
}

export function guardClaimedToFrscVerified(ctx: { frscOperatorLicence: string | null; kycTier: number }): { allowed: boolean; reason?: string } {
  if (!ctx.frscOperatorLicence) return { allowed: false, reason: 'FRSC operator licence required for frsc_verified transition' };
  if (ctx.kycTier < 2) return { allowed: false, reason: 'KYC Tier 2 required for frsc_verified transition' };
  return { allowed: true };
}
