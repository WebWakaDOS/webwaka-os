/**
 * @webwaka/verticals-airport-shuttle — Domain types
 * M12 Transport Extended — Task V-TRN-EXT-4
 *
 * FSM: seeded → claimed → faan_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:        KYC Tier 1
 *   claimed → faan_verified: FAAN permit required; KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: passenger_phone, flight_number never passed to AI layer
 */

export type AirportShuttleFSMState =
  | 'seeded'
  | 'claimed'
  | 'faan_verified'
  | 'active'
  | 'suspended';

export type BookingStatus =
  | 'booked'
  | 'confirmed'
  | 'dispatched'
  | 'completed'
  | 'cancelled';

export type VehicleType = 'sedan' | 'SUV' | 'minibus';
export type VehicleAvailability = 'available' | 'on_trip' | 'maintenance';

export interface AirportShuttleProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  faanPermit: string | null;
  frscCommercialLicence: string | null;
  cacRc: string | null;
  status: AirportShuttleFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAirportShuttleInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  faanPermit?: string | undefined;
  frscCommercialLicence?: string | undefined;
  cacRc?: string | undefined;
}

export interface UpdateAirportShuttleInput {
  companyName?: string | undefined;
  faanPermit?: string | null | undefined;
  frscCommercialLicence?: string | null | undefined;
  cacRc?: string | null | undefined;
  status?: AirportShuttleFSMState | undefined;
}

export interface ShuttleVehicle {
  id: string;
  profileId: string;
  tenantId: string;
  vehiclePlate: string;
  type: VehicleType;
  capacity: number;
  driverId: string | null;
  frscCert: string | null;
  status: VehicleAvailability;
  createdAt: number;
  updatedAt: number;
}

export interface CreateShuttleVehicleInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  vehiclePlate: string;
  type?: VehicleType | undefined;
  capacity?: number | undefined;
  driverId?: string | undefined;
  frscCert?: string | undefined;
}

export interface ShuttleBooking {
  id: string;
  profileId: string;
  tenantId: string;
  passengerPhone: string | null;
  flightNumber: string | null;
  pickupAirport: string | null;
  destination: string | null;
  pickupTime: number | null;
  driverId: string | null;
  vehicleId: string | null;
  fareKobo: number;
  status: BookingStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateShuttleBookingInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  passengerPhone?: string | undefined;
  flightNumber?: string | undefined;
  pickupAirport?: string | undefined;
  destination?: string | undefined;
  pickupTime?: number | undefined;
  fareKobo: number;
}

export const VALID_AIRPORT_SHUTTLE_TRANSITIONS: Record<AirportShuttleFSMState, AirportShuttleFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['faan_verified', 'suspended'],
  faan_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidAirportShuttleTransition(from: AirportShuttleFSMState, to: AirportShuttleFSMState): boolean {
  return VALID_AIRPORT_SHUTTLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim airport shuttle profile' };
  return { allowed: true };
}

export function guardClaimedToFaanVerified(ctx: { faanPermit: string | null; kycTier: number }): { allowed: boolean; reason?: string } {
  if (!ctx.faanPermit) return { allowed: false, reason: 'FAAN permit required for faan_verified transition' };
  if (ctx.kycTier < 2) return { allowed: false, reason: 'KYC Tier 2 required for faan_verified transition' };
  return { allowed: true };
}
