/**
 * @webwaka/verticals-courier — Domain types
 * M9 Transport Extended — Task V-TRN-EXT-2
 *
 * FSM: seeded → claimed → cac_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:       KYC Tier 1
 *   claimed → cac_verified: CAC RC required; KYC Tier 2
 * Platform Invariants: P9 (kobo/gram integers), T3 (tenant_id always present)
 * P13: sender_phone, receiver_phone, parcel descriptions never passed to AI layer
 */

export type CourierFSMState =
  | 'seeded'
  | 'claimed'
  | 'cac_verified'
  | 'active'
  | 'suspended';

export type ParcelStatus =
  | 'intake'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'failed';

export type RiderStatus = 'available' | 'on_delivery' | 'offline';
export type VehicleType = 'bicycle' | 'motorcycle' | 'van';

export interface CourierProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  nccRegistered: boolean;
  cacRc: string | null;
  status: CourierFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCourierInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  nccRegistered?: boolean | undefined;
  cacRc?: string | undefined;
}

export interface UpdateCourierInput {
  companyName?: string | undefined;
  nccRegistered?: boolean | undefined;
  cacRc?: string | null | undefined;
  status?: CourierFSMState | undefined;
}

export interface CourierRider {
  id: string;
  profileId: string;
  tenantId: string;
  riderName: string;
  phone: string | null;
  vehicleType: VehicleType;
  licenseNumber: string | null;
  status: RiderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRiderInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  riderName: string;
  phone?: string | undefined;
  vehicleType?: VehicleType | undefined;
  licenseNumber?: string | undefined;
}

export interface CourierParcel {
  id: string;
  profileId: string;
  tenantId: string;
  trackingCode: string;
  senderPhone: string | null;
  receiverPhone: string | null;
  weightGrams: number;
  description: string | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
  deliveryFeeKobo: number;
  codAmountKobo: number;
  riderId: string | null;
  status: ParcelStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateParcelInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  trackingCode: string;
  senderPhone?: string | undefined;
  receiverPhone?: string | undefined;
  weightGrams: number;
  description?: string | undefined;
  pickupAddress?: string | undefined;
  deliveryAddress?: string | undefined;
  deliveryFeeKobo: number;
  codAmountKobo?: number | undefined;
}

export interface CodRemittance {
  id: string;
  parcelId: string;
  tenantId: string;
  collectedKobo: number;
  remittedKobo: number;
  remittanceDate: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCodRemittanceInput {
  id?: string | undefined;
  parcelId: string;
  tenantId: string;
  collectedKobo: number;
  remittedKobo: number;
  remittanceDate?: number | undefined;
}

export const VALID_COURIER_TRANSITIONS: Record<CourierFSMState, CourierFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['cac_verified', 'suspended'],
  cac_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidCourierTransition(from: CourierFSMState, to: CourierFSMState): boolean {
  return VALID_COURIER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim courier profile' };
  return { allowed: true };
}

export function guardClaimedToCacVerified(ctx: { cacRc: string | null; kycTier: number }): { allowed: boolean; reason?: string } {
  if (!ctx.cacRc) return { allowed: false, reason: 'CAC RC required for cac_verified transition' };
  if (ctx.kycTier < 2) return { allowed: false, reason: 'KYC Tier 2 required for cac_verified transition' };
  return { allowed: true };
}
