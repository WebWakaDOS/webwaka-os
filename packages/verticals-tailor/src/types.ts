/**
 * @webwaka/verticals-tailor — Domain types
 * M10 Commerce P2 Batch 2 — Task V-COMM-EXT-B10
 *
 * FSM: seeded → claimed → active (3-state informal pattern)
 * KYC gates:
 *   seeded → claimed: KYC Tier 1 for informal tailors
 *   Bulk Aso-Ebi contracts above ₦500,000: KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * Measurements stored as integer cm×10 to avoid floats
 * P13: Client measurements and phone numbers never passed to AI
 */

export type TailorFSMState = 'seeded' | 'claimed' | 'active' | 'suspended';

export type TailorType = 'bespoke' | 'aso-ebi' | 'ready-to-wear' | 'all';

export type TailorOrderStatus =
  | 'intake'
  | 'cutting'
  | 'sewing'
  | 'finishing'
  | 'ready'
  | 'collected';

export interface TailorMeasurements {
  bust?: number | undefined;
  waist?: number | undefined;
  hip?: number | undefined;
  shoulder?: number | undefined;
  sleeve?: number | undefined;
  thigh?: number | undefined;
  inseam?: number | undefined;
}

export interface TailorProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  businessName: string;
  type: TailorType;
  cacOrTradeAssocNumber: string | null;
  state: string | null;
  lga: string | null;
  status: TailorFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTailorInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  businessName: string;
  type?: TailorType | undefined;
  cacOrTradeAssocNumber?: string | undefined;
  state?: string | undefined;
  lga?: string | undefined;
}

export interface UpdateTailorInput {
  businessName?: string | undefined;
  type?: TailorType | undefined;
  cacOrTradeAssocNumber?: string | null | undefined;
  state?: string | null | undefined;
  lga?: string | null | undefined;
  status?: TailorFSMState | undefined;
}

export interface TailorClient {
  id: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  measurements: TailorMeasurements;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTailorClientInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  measurements?: TailorMeasurements | undefined;
}

export interface TailorOrder {
  id: string;
  clientId: string;
  workspaceId: string;
  tenantId: string;
  styleDescription: string;
  fabricType: string | null;
  deliveryDate: number | null;
  priceKobo: number;
  depositKobo: number;
  balanceKobo: number;
  status: TailorOrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTailorOrderInput {
  id?: string | undefined;
  clientId: string;
  workspaceId: string;
  tenantId: string;
  styleDescription: string;
  fabricType?: string | undefined;
  deliveryDate?: number | undefined;
  priceKobo: number;
  depositKobo: number;
  balanceKobo: number;
}

export interface TailorFabricStock {
  id: string;
  workspaceId: string;
  tenantId: string;
  fabricName: string;
  colour: string | null;
  fabricType: string | null;
  metresAvailableCm: number;
  costPerMetreKobo: number;
  supplier: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTailorFabricStockInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  fabricName: string;
  colour?: string | undefined;
  fabricType?: string | undefined;
  metresAvailableCm?: number | undefined;
  costPerMetreKobo: number;
  supplier?: string | undefined;
}

export const VALID_TAILOR_TRANSITIONS: Record<TailorFSMState, TailorFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidTailorTransition(from: TailorFSMState, to: TailorFSMState): boolean {
  return VALID_TAILOR_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim tailor profile' };
  return { allowed: true };
}
