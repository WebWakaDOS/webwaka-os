/**
 * @webwaka/verticals-spa — Domain types
 * M10 Commerce P2 Batch 2 — Task V-COMM-EXT-B9
 *
 * FSM: seeded → claimed → permit_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   Appointment deposits: KYC Tier 1
 *   Membership subscriptions above ₦200,000/year: KYC Tier 2
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: Client health intake data never passed to AI
 */

export type SpaFSMState =
  | 'seeded'
  | 'claimed'
  | 'permit_verified'
  | 'active'
  | 'suspended';

export type SpaType = 'day_spa' | 'hotel_spa' | 'mobile';
export type ServiceCategory = 'massage' | 'facial' | 'body' | 'nail' | 'other';
export type AppointmentStatus = 'booked' | 'confirmed' | 'in_session' | 'completed' | 'cancelled' | 'no_show';

export interface SpaProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  spaName: string;
  type: SpaType;
  nascNumber: string | null;
  stateHealthPermit: string | null;
  status: SpaFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSpaInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  spaName: string;
  type: SpaType;
  nascNumber?: string | undefined;
  stateHealthPermit?: string | undefined;
}

export interface UpdateSpaInput {
  spaName?: string | undefined;
  type?: SpaType | undefined;
  nascNumber?: string | null | undefined;
  stateHealthPermit?: string | null | undefined;
  status?: SpaFSMState | undefined;
}

export interface SpaService {
  id: string;
  workspaceId: string;
  tenantId: string;
  serviceName: string;
  category: ServiceCategory;
  durationMinutes: number;
  priceKobo: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSpaServiceInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  serviceName: string;
  category?: ServiceCategory | undefined;
  durationMinutes?: number | undefined;
  priceKobo: number;
}

export interface SpaAppointment {
  id: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  serviceId: string;
  therapistId: string | null;
  roomNumber: string | null;
  appointmentTime: number;
  status: AppointmentStatus;
  depositKobo: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSpaAppointmentInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  serviceId: string;
  therapistId?: string | undefined;
  roomNumber?: string | undefined;
  appointmentTime: number;
  depositKobo?: number | undefined;
}

export interface SpaMembership {
  id: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  packageName: string;
  monthlyFeeKobo: number;
  sessionsPerMonth: number;
  sessionsUsed: number;
  validUntil: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSpaMembershipInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  packageName: string;
  monthlyFeeKobo: number;
  sessionsPerMonth?: number | undefined;
  validUntil?: number | undefined;
}

export const VALID_SPA_TRANSITIONS: Record<SpaFSMState, SpaFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['permit_verified', 'suspended'],
  permit_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidSpaTransition(from: SpaFSMState, to: SpaFSMState): boolean {
  return VALID_SPA_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim spa profile' };
  return { allowed: true };
}

export function guardClaimedToPermitVerified(ctx: { nascNumber: string | null; stateHealthPermit: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.nascNumber) return { allowed: false, reason: 'NASC number required for permit_verified transition' };
  if (!ctx.stateHealthPermit) return { allowed: false, reason: 'State health permit required for permit_verified transition' };
  return { allowed: true };
}
