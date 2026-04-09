/**
 * @webwaka/verticals-print-shop — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B3
 *
 * FSM: seeded → claimed → cac_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   Bulk contracts above ₦500,000 (50_000_000 kobo): KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 */

export type PrintShopFSMState =
  | 'seeded'
  | 'claimed'
  | 'cac_verified'
  | 'active'
  | 'suspended';

export type PrintSpeciality = 'digital' | 'offset' | 'large_format' | 'all';
export type PrintJobType = 'flyer' | 'banner' | 'brochure' | 'packaging' | 'signage' | 'other';
export type ColourMode = 'full_colour' | 'black_white' | 'spot';
export type PrintJobStatus = 'received' | 'proof_sent' | 'approved' | 'printing' | 'ready' | 'delivered';

export interface PrintShopProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  shopName: string;
  cacNumber: string | null;
  sonRegistered: boolean;
  speciality: PrintSpeciality | null;
  status: PrintShopFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePrintShopInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  shopName: string;
  cacNumber?: string | undefined;
  sonRegistered?: boolean | undefined;
  speciality?: PrintSpeciality | undefined;
}

export interface UpdatePrintShopInput {
  shopName?: string | undefined;
  cacNumber?: string | null | undefined;
  sonRegistered?: boolean | undefined;
  speciality?: PrintSpeciality | null | undefined;
  status?: PrintShopFSMState | undefined;
}

export interface PrintJob {
  id: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  jobType: PrintJobType;
  quantity: number;
  size: string | null;
  paperType: string | null;
  colourMode: ColourMode | null;
  unitPriceKobo: number;
  totalKobo: number;
  designRef: string | null;
  status: PrintJobStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePrintJobInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  jobType: PrintJobType;
  quantity?: number | undefined;
  size?: string | undefined;
  paperType?: string | undefined;
  colourMode?: ColourMode | undefined;
  unitPriceKobo: number;
  totalKobo: number;
  designRef?: string | undefined;
}

export interface PrintStock {
  id: string;
  workspaceId: string;
  tenantId: string;
  paperType: string;
  gsm: number | null;
  sheetSize: string | null;
  quantityInStock: number;
  unitCostKobo: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePrintStockInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  paperType: string;
  gsm?: number | undefined;
  sheetSize?: string | undefined;
  quantityInStock?: number | undefined;
  unitCostKobo: number;
}

export const VALID_PRINT_SHOP_TRANSITIONS: Record<PrintShopFSMState, PrintShopFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['cac_verified', 'suspended'],
  cac_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidPrintShopTransition(from: PrintShopFSMState, to: PrintShopFSMState): boolean {
  return VALID_PRINT_SHOP_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim print shop profile' };
  return { allowed: true };
}

export function guardClaimedToCacVerified(ctx: { cacNumber: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.cacNumber) return { allowed: false, reason: 'CAC number required for cac_verified transition' };
  return { allowed: true };
}
