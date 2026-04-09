/**
 * @webwaka/verticals-welding-fabrication — Domain types
 * M10 Commerce P2 Batch 2 — Task V-COMM-EXT-B12
 *
 * FSM: seeded → claimed → active (3-state informal pattern)
 * KYC gates:
 *   seeded → claimed: KYC Tier 1 for informal shops
 *   Structural contracts above ₦500,000: KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: No client details passed to AI — only aggregate revenue/material stats
 */

export type WeldingFSMState = 'seeded' | 'claimed' | 'active' | 'suspended';

export type WeldingSpeciality = 'gate' | 'structural' | 'tank' | 'general';
export type WeldingJobStatus = 'quoted' | 'confirmed' | 'in_progress' | 'completed' | 'collected';
export type MaterialUnit = 'kg' | 'metre' | 'sheet' | 'piece';

export interface WeldingShopProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  shopName: string;
  cacOrTradeNumber: string | null;
  speciality: WeldingSpeciality;
  state: string | null;
  lga: string | null;
  status: WeldingFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWeldingShopInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  shopName: string;
  speciality?: WeldingSpeciality | undefined;
  cacOrTradeNumber?: string | undefined;
  state?: string | undefined;
  lga?: string | undefined;
}

export interface UpdateWeldingShopInput {
  shopName?: string | undefined;
  speciality?: WeldingSpeciality | undefined;
  cacOrTradeNumber?: string | null | undefined;
  state?: string | null | undefined;
  lga?: string | null | undefined;
  status?: WeldingFSMState | undefined;
}

export interface WeldingJob {
  id: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  description: string;
  materialCostKobo: number;
  labourCostKobo: number;
  totalKobo: number;
  deliveryDate: number | null;
  status: WeldingJobStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWeldingJobInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  description: string;
  materialCostKobo: number;
  labourCostKobo: number;
  totalKobo: number;
  deliveryDate?: number | undefined;
}

export interface WeldingMaterial {
  id: string;
  workspaceId: string;
  tenantId: string;
  materialName: string;
  unit: MaterialUnit;
  quantityInStock: number;
  unitCostKobo: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateWeldingMaterialInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  materialName: string;
  unit: MaterialUnit;
  quantityInStock?: number | undefined;
  unitCostKobo: number;
}

export const VALID_WELDING_TRANSITIONS: Record<WeldingFSMState, WeldingFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidWeldingTransition(from: WeldingFSMState, to: WeldingFSMState): boolean {
  return VALID_WELDING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim welding shop profile' };
  return { allowed: true };
}
