/**
 * @webwaka/verticals-property-developer — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B4
 *
 * FSM: seeded → claimed → surcon_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   surcon_verified: SURCON + TOPREC required
 *   All property operations: KYC Tier 3 mandatory (high-value transactions)
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 */

export type PropertyDeveloperFSMState =
  | 'seeded'
  | 'claimed'
  | 'surcon_verified'
  | 'active'
  | 'suspended';

export type LandTitleType = 'C_of_O' | 'Deed' | 'Gazette' | 'Excision';
export type UnitType = '1bed' | '2bed' | '3bed' | 'duplex' | 'bungalow' | 'commercial';
export type UnitStatus = 'available' | 'reserved' | 'allocated' | 'completed';
export type AllocationStatus = 'active' | 'completed' | 'defaulted';
export type EstateStatus = 'planning' | 'active' | 'sold_out' | 'completed';

export interface PropertyDeveloperProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  surconNumber: string | null;
  toprecNumber: string | null;
  cacRc: string | null;
  status: PropertyDeveloperFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePropertyDeveloperInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  surconNumber?: string | undefined;
  toprecNumber?: string | undefined;
  cacRc?: string | undefined;
}

export interface UpdatePropertyDeveloperInput {
  companyName?: string | undefined;
  surconNumber?: string | null | undefined;
  toprecNumber?: string | null | undefined;
  cacRc?: string | null | undefined;
  status?: PropertyDeveloperFSMState | undefined;
}

export interface PropertyEstate {
  id: string;
  workspaceId: string;
  tenantId: string;
  estateName: string;
  location: string | null;
  state: string | null;
  lga: string | null;
  landTitleType: LandTitleType | null;
  permitNumber: string | null;
  totalUnits: number;
  status: EstateStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePropertyEstateInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  estateName: string;
  location?: string | undefined;
  state?: string | undefined;
  lga?: string | undefined;
  landTitleType?: LandTitleType | undefined;
  permitNumber?: string | undefined;
  totalUnits?: number | undefined;
}

export interface PropertyUnit {
  id: string;
  estateId: string;
  workspaceId: string;
  tenantId: string;
  unitType: UnitType;
  unitNumber: string;
  floorAreaSqm: number;
  priceKobo: number;
  status: UnitStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePropertyUnitInput {
  id?: string | undefined;
  estateId: string;
  workspaceId: string;
  tenantId: string;
  unitType: UnitType;
  unitNumber: string;
  floorAreaSqm: number;
  priceKobo: number;
}

export interface InstalmentEntry {
  amountKobo: number;
  dueDate: number;
}

export interface PropertyAllocation {
  id: string;
  unitId: string;
  workspaceId: string;
  tenantId: string;
  buyerPhone: string;
  buyerName: string;
  totalPriceKobo: number;
  depositKobo: number;
  instalmentPlan: InstalmentEntry[];
  status: AllocationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePropertyAllocationInput {
  id?: string | undefined;
  unitId: string;
  workspaceId: string;
  tenantId: string;
  buyerPhone: string;
  buyerName: string;
  totalPriceKobo: number;
  depositKobo: number;
  instalmentPlan?: InstalmentEntry[] | undefined;
}

export const VALID_PROPERTY_DEVELOPER_TRANSITIONS: Record<PropertyDeveloperFSMState, PropertyDeveloperFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['surcon_verified', 'suspended'],
  surcon_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidPropertyDeveloperTransition(from: PropertyDeveloperFSMState, to: PropertyDeveloperFSMState): boolean {
  return VALID_PROPERTY_DEVELOPER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim property developer profile' };
  return { allowed: true };
}

export function guardClaimedToSurconVerified(ctx: { surconNumber: string | null; toprecNumber: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.surconNumber) return { allowed: false, reason: 'SURCON number required for surcon_verified transition' };
  if (!ctx.toprecNumber) return { allowed: false, reason: 'TOPREC number required for surcon_verified transition' };
  return { allowed: true };
}

export function guardPropertyOperation(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 3) return { allowed: false, reason: 'KYC Tier 3 required for property operations' };
  return { allowed: true };
}
