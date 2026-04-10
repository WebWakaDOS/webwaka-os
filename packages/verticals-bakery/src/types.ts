/**
 * @webwaka/verticals-bakery — Domain types
 * M9 Commerce P2 — Task V-COMM-EXT-A2
 *
 * FSM: seeded → claimed → nafdac_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:         KYC Tier 1
 *   nafdac_verified → active: NAFDAC license number + future expiry required
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 */

export type BakeryFSMState =
  | 'seeded'
  | 'claimed'
  | 'nafdac_verified'
  | 'active'
  | 'suspended';

export type BakeryProductCategory = 'bread' | 'cake' | 'pastry' | 'snack';

export type BakeryOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'baking'
  | 'ready'
  | 'delivered';

export interface BakeryProfile {
  id: string;
  workspaceId: string;
  tenantId: string;                    // T3
  bakeryName: string;
  nafdacNumber: string | null;
  productionLicenseExpiry: number | null; // unix timestamp
  cacNumber: string | null;
  foodHandlerCount: number;
  status: BakeryFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateBakeryInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  bakeryName: string;
  nafdacNumber?: string | undefined;
  cacNumber?: string | undefined;
}

export interface UpdateBakeryInput {
  bakeryName?: string | undefined;
  nafdacNumber?: string | null | undefined;
  productionLicenseExpiry?: number | null | undefined;
  cacNumber?: string | null | undefined;
  foodHandlerCount?: number | undefined;
  status?: BakeryFSMState | undefined;
}

export interface BakeryProduct {
  id: string;
  workspaceId: string;
  tenantId: string;           // T3
  productName: string;
  category: BakeryProductCategory;
  unitPriceKobo: number;      // P9
  productionCostKobo: number; // P9
  dailyCapacity: number;
  createdAt: number;
}

export interface CreateBakeryProductInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  productName: string;
  category: BakeryProductCategory;
  unitPriceKobo: number;
  productionCostKobo?: number | undefined;
  dailyCapacity?: number | undefined;
}

export interface BakeryOrder {
  id: string;
  workspaceId: string;
  tenantId: string;           // T3
  customerPhone: string;      // P13 — never sent to AI
  productId: string | null;
  quantity: number;
  customizationNotes: string | null;
  depositKobo: number;        // P9
  balanceKobo: number;        // P9
  deliveryDate: number | null;
  status: BakeryOrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateBakeryOrderInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  customerPhone: string;
  productId?: string | undefined;
  quantity: number;
  customizationNotes?: string | undefined;
  depositKobo: number;
  balanceKobo: number;
  deliveryDate?: number | undefined;
}

export interface BakeryIngredient {
  id: string;
  workspaceId: string;
  tenantId: string;       // T3
  ingredientName: string;
  unit: string;
  quantityInStockX1000: number; // P9 — stored ×1000, divide by 1000 for display
  unitCostKobo: number;   // P9
  reorderLevelX1000: number; // P9 — stored ×1000
  createdAt: number;
}

export interface CreateBakeryIngredientInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  ingredientName: string;
  unit: string;
  quantityInStockX1000: number; // P9 — stored ×1000, divide by 1000 for display
  unitCostKobo: number;
  reorderLevelX1000?: number | undefined;
}

// ---------------------------------------------------------------------------
// FSM guard functions (pure — no I/O)
// ---------------------------------------------------------------------------

export type FSMGuardResult = { allowed: true } | { allowed: false; reason: string };

export function guardSeedToClaimed(opts: { kycTier: number }): FSMGuardResult {
  if (opts.kycTier < 1) {
    return { allowed: false, reason: 'KYC Tier 1 required to claim bakery profile' };
  }
  return { allowed: true };
}

export function guardClaimedToNafdacVerified(opts: {
  nafdacNumber: string | null;
}): FSMGuardResult {
  if (!opts.nafdacNumber) {
    return { allowed: false, reason: 'NAFDAC license number required for verification' };
  }
  return { allowed: true };
}

export function guardNafdacVerifiedToActive(opts: {
  productionLicenseExpiry: number | null;
}): FSMGuardResult {
  if (!opts.productionLicenseExpiry) {
    return { allowed: false, reason: 'Production license expiry date required' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (opts.productionLicenseExpiry <= now) {
    return { allowed: false, reason: 'Production license has expired — renew before going active' };
  }
  return { allowed: true };
}

export const VALID_BAKERY_TRANSITIONS: Array<[BakeryFSMState, BakeryFSMState]> = [
  ['seeded',          'claimed'],
  ['claimed',         'nafdac_verified'],
  ['nafdac_verified', 'active'],
  ['active',          'suspended'],
  ['suspended',       'active'],
  ['claimed',         'suspended'],
];

export function isValidBakeryTransition(
  from: BakeryFSMState,
  to: BakeryFSMState,
): boolean {
  return VALID_BAKERY_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
