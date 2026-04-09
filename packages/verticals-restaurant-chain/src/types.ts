/**
 * @webwaka/verticals-restaurant-chain — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B6
 *
 * FSM: seeded → claimed → nafdac_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   Delivery platform integrations: KYC Tier 3
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * Note: distinct from P1 'restaurant' vertical (single-outlet basic)
 */

export type RestaurantChainFSMState =
  | 'seeded'
  | 'claimed'
  | 'nafdac_verified'
  | 'active'
  | 'suspended';

export type MenuCategory = 'starter' | 'main' | 'side' | 'dessert' | 'drink' | 'snack';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'placed' | 'kitchen' | 'ready' | 'served' | 'paid';

export interface RestaurantChainProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  brandName: string;
  nafdacNumber: string | null;
  cacRc: string | null;
  outletCount: number;
  status: RestaurantChainFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRestaurantChainInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  brandName: string;
  nafdacNumber?: string | undefined;
  cacRc?: string | undefined;
  outletCount?: number | undefined;
}

export interface UpdateRestaurantChainInput {
  brandName?: string | undefined;
  nafdacNumber?: string | null | undefined;
  cacRc?: string | null | undefined;
  outletCount?: number | undefined;
  status?: RestaurantChainFSMState | undefined;
}

export interface RestaurantOutlet {
  id: string;
  brandId: string;
  workspaceId: string;
  tenantId: string;
  outletName: string;
  address: string | null;
  state: string | null;
  lga: string | null;
  nafdacOutletCert: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRestaurantOutletInput {
  id?: string | undefined;
  brandId: string;
  workspaceId: string;
  tenantId: string;
  outletName: string;
  address?: string | undefined;
  state?: string | undefined;
  lga?: string | undefined;
  nafdacOutletCert?: string | undefined;
}

export interface RestaurantChainMenuItem {
  id: string;
  outletId: string;
  workspaceId: string;
  tenantId: string;
  itemName: string;
  category: MenuCategory;
  priceKobo: number;
  available: boolean;
  prepTimeMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRestaurantChainMenuItemInput {
  id?: string | undefined;
  outletId: string;
  workspaceId: string;
  tenantId: string;
  itemName: string;
  category?: MenuCategory | undefined;
  priceKobo: number;
  prepTimeMinutes?: number | undefined;
}

export interface RestaurantChainOrder {
  id: string;
  outletId: string;
  workspaceId: string;
  tenantId: string;
  tableNumber: string | null;
  orderType: OrderType;
  items: string;
  totalKobo: number;
  status: OrderStatus;
  customerPhone: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRestaurantChainOrderInput {
  id?: string | undefined;
  outletId: string;
  workspaceId: string;
  tenantId: string;
  tableNumber?: string | undefined;
  orderType: OrderType;
  items?: string | undefined;
  totalKobo: number;
  customerPhone?: string | undefined;
}

export const VALID_RESTAURANT_CHAIN_TRANSITIONS: Record<RestaurantChainFSMState, RestaurantChainFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['nafdac_verified', 'suspended'],
  nafdac_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidRestaurantChainTransition(from: RestaurantChainFSMState, to: RestaurantChainFSMState): boolean {
  return VALID_RESTAURANT_CHAIN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim restaurant chain profile' };
  return { allowed: true };
}

export function guardClaimedToNafdacVerified(ctx: { nafdacNumber: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.nafdacNumber) return { allowed: false, reason: 'NAFDAC number required for nafdac_verified transition' };
  return { allowed: true };
}
