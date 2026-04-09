/**
 * @webwaka/verticals-real-estate-agency — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B5
 *
 * FSM: seeded → claimed → niesv_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   Commission invoicing: KYC Tier 2
 *   Property escrow: KYC Tier 3
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 */

export type RealEstateAgencyFSMState =
  | 'seeded'
  | 'claimed'
  | 'niesv_verified'
  | 'active'
  | 'suspended';

export type PropertyType = 'flat' | 'duplex' | 'bungalow' | 'land' | 'commercial';
export type TransactionType = 'sale' | 'rent';
export type ListingStatus = 'available' | 'under_offer' | 'let' | 'sold';
export type EnquiryType = 'viewing' | 'offer' | 'rent';
export type EnquiryStatus = 'new' | 'viewing_scheduled' | 'offer_made' | 'accepted' | 'closed';
export type CommissionStatus = 'pending' | 'invoiced' | 'received';

export interface RealEstateAgencyProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  agencyName: string;
  niesvNumber: string | null;
  esvarbonNumber: string | null;
  cacNumber: string | null;
  status: RealEstateAgencyFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateRealEstateAgencyInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  agencyName: string;
  niesvNumber?: string | undefined;
  esvarbonNumber?: string | undefined;
  cacNumber?: string | undefined;
}

export interface UpdateRealEstateAgencyInput {
  agencyName?: string | undefined;
  niesvNumber?: string | null | undefined;
  esvarbonNumber?: string | null | undefined;
  cacNumber?: string | null | undefined;
  status?: RealEstateAgencyFSMState | undefined;
}

export interface PropertyListing {
  id: string;
  workspaceId: string;
  tenantId: string;
  title: string;
  type: PropertyType;
  transactionType: TransactionType;
  state: string | null;
  lga: string | null;
  address: string | null;
  priceKobo: number;
  bedrooms: number | null;
  bathrooms: number | null;
  status: ListingStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePropertyListingInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  title: string;
  type: PropertyType;
  transactionType: TransactionType;
  state?: string | undefined;
  lga?: string | undefined;
  address?: string | undefined;
  priceKobo: number;
  bedrooms?: number | undefined;
  bathrooms?: number | undefined;
}

export interface PropertyEnquiry {
  id: string;
  listingId: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  clientName: string;
  enquiryType: EnquiryType;
  offerPriceKobo: number | null;
  status: EnquiryStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePropertyEnquiryInput {
  id?: string | undefined;
  listingId: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  clientName: string;
  enquiryType: EnquiryType;
  offerPriceKobo?: number | undefined;
}

export interface PropertyCommission {
  id: string;
  listingId: string;
  workspaceId: string;
  tenantId: string;
  transactionType: TransactionType;
  grossValueKobo: number;
  commissionRatePct: number;
  commissionKobo: number;
  status: CommissionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreatePropertyCommissionInput {
  id?: string | undefined;
  listingId: string;
  workspaceId: string;
  tenantId: string;
  transactionType: TransactionType;
  grossValueKobo: number;
  commissionRatePct: number;
}

export const VALID_REAL_ESTATE_AGENCY_TRANSITIONS: Record<RealEstateAgencyFSMState, RealEstateAgencyFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['niesv_verified', 'suspended'],
  niesv_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidRealEstateAgencyTransition(from: RealEstateAgencyFSMState, to: RealEstateAgencyFSMState): boolean {
  return VALID_REAL_ESTATE_AGENCY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim real estate agency profile' };
  return { allowed: true };
}

export function guardClaimedToNiesvVerified(ctx: { niesvNumber: string | null; esvarbonNumber: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.niesvNumber) return { allowed: false, reason: 'NIESV number required for niesv_verified transition' };
  if (!ctx.esvarbonNumber) return { allowed: false, reason: 'ESVARBON number required for niesv_verified transition' };
  return { allowed: true };
}
