/**
 * @webwaka/verticals-fuel-station — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B2
 *
 * FSM: seeded → claimed → nuprc_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   Retail credit accounts: KYC Tier 3; standard cash: Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * Volumes: stored as integer millilitres (not floats)
 */

export type FuelStationFSMState =
  | 'seeded'
  | 'claimed'
  | 'nuprc_verified'
  | 'active'
  | 'suspended';

export type FuelProduct = 'PMS' | 'AGO' | 'DPK';
export type DealerType = 'independent' | 'nnpc_mega' | 'total' | 'ardova';

export interface FuelStationProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  stationName: string;
  nuprcLicence: string | null;
  nuprcExpiry: number | null;
  dealerType: DealerType | null;
  cacNumber: string | null;
  state: string | null;
  lga: string | null;
  status: FuelStationFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateFuelStationInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  stationName: string;
  nuprcLicence?: string | undefined;
  nuprcExpiry?: number | undefined;
  dealerType?: DealerType | undefined;
  cacNumber?: string | undefined;
  state?: string | undefined;
  lga?: string | undefined;
}

export interface UpdateFuelStationInput {
  stationName?: string | undefined;
  nuprcLicence?: string | null | undefined;
  nuprcExpiry?: number | null | undefined;
  dealerType?: DealerType | null | undefined;
  cacNumber?: string | null | undefined;
  state?: string | null | undefined;
  lga?: string | null | undefined;
  status?: FuelStationFSMState | undefined;
}

export interface FuelPump {
  id: string;
  stationId: string;
  workspaceId: string;
  tenantId: string;
  pumpNumber: string;
  product: FuelProduct;
  currentPriceKoboPerLitre: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateFuelPumpInput {
  id?: string | undefined;
  stationId: string;
  workspaceId: string;
  tenantId: string;
  pumpNumber: string;
  product: FuelProduct;
  currentPriceKoboPerLitre: number;
}

export interface FuelDailyReading {
  id: string;
  pumpId: string;
  workspaceId: string;
  tenantId: string;
  shiftDate: number;
  openingMeter: number;
  closingMeter: number;
  litresSoldMl: number;
  cashReceivedKobo: number;
  attendantName: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateFuelDailyReadingInput {
  id?: string | undefined;
  pumpId: string;
  workspaceId: string;
  tenantId: string;
  shiftDate: number;
  openingMeter: number;
  closingMeter: number;
  litresSoldMl: number;
  cashReceivedKobo: number;
  attendantName?: string | undefined;
}

export interface FuelTankStock {
  id: string;
  stationId: string;
  workspaceId: string;
  tenantId: string;
  product: FuelProduct;
  capacityMl: number;
  currentLevelMl: number;
  lastDeliveryMl: number;
  lastDeliveryDate: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateFuelTankStockInput {
  id?: string | undefined;
  stationId: string;
  workspaceId: string;
  tenantId: string;
  product: FuelProduct;
  capacityMl: number;
  currentLevelMl?: number | undefined;
  lastDeliveryMl?: number | undefined;
  lastDeliveryDate?: number | undefined;
}

export const VALID_FUEL_STATION_TRANSITIONS: Record<FuelStationFSMState, FuelStationFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['nuprc_verified', 'suspended'],
  nuprc_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidFuelStationTransition(from: FuelStationFSMState, to: FuelStationFSMState): boolean {
  return VALID_FUEL_STATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim fuel station profile' };
  return { allowed: true };
}

export function guardClaimedToNuprcVerified(ctx: { nuprcLicence: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.nuprcLicence) return { allowed: false, reason: 'NUPRC licence number required for nuprc_verified transition' };
  return { allowed: true };
}
