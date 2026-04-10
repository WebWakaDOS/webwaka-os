/**
 * @webwaka/verticals-events-centre — types + FSM guards (M12)
 * FSM: seeded → claimed → licence_verified → active → suspended
 * AI: L2 cap — section utilisation, seasonal demand (aggregate only); no client details to AI (P13)
 * P9: all monetary values in kobo integers; capacity_guests INTEGER; total_nights INTEGER
 * Section conflict check (overlapping dates for same section) enforced at route level
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 deposit collection; Tier 3 for multi-day corporate events above ₦10M
 */

export type EventsCentreFSMState =
  | 'seeded'
  | 'claimed'
  | 'licence_verified'
  | 'active'
  | 'suspended';

export type BookingStatus = 'enquiry' | 'confirmed' | 'completed' | 'cancelled';

const FSM_TRANSITIONS: Record<EventsCentreFSMState, EventsCentreFSMState[]> = {
  seeded:           ['claimed'],
  claimed:          ['licence_verified'],
  licence_verified: ['active'],
  active:           ['suspended'],
  suspended:        ['active'],
};

export function isValidEventsCentreTransition(from: EventsCentreFSMState, to: EventsCentreFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToLicenceVerified(input: { stateEventLicence: string | null }): GuardResult {
  if (!input.stateEventLicence || input.stateEventLicence.trim() === '') {
    return { allowed: false, reason: 'State event licence required to verify events centre' };
  }
  return { allowed: true };
}

export function guardSectionConflict(input: { conflictExists: boolean; sectionName: string }): GuardResult {
  if (input.conflictExists) {
    return { allowed: false, reason: `Section "${input.sectionName}" has an overlapping booking for the requested dates` };
  }
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'Events centre AI capped at L2 advisory — section utilisation aggregate only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'Events centre AI capped at L2' };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface EventsCentreProfile {
  id: string; workspaceId: string; tenantId: string;
  centreName: string; stateEventLicence: string | null;
  fireSafetyCert: string | null; lawmaCompliance: string | null; cacRc: string | null;
  status: EventsCentreFSMState; createdAt: number; updatedAt: number;
}

export interface EventsCentreSection {
  id: string; profileId: string; tenantId: string;
  sectionName: string; capacityGuests: number; dailyRateKobo: number;
  amenities: string | null; createdAt: number; updatedAt: number;
}

export interface EventsCentreBooking {
  id: string; profileId: string; tenantId: string;
  clientPhone: string; sectionIds: string; eventType: string;
  startDate: number; endDate: number; totalNights: number;
  packageKobo: number; depositKobo: number; balanceKobo: number;
  status: BookingStatus; createdAt: number; updatedAt: number;
}

export interface CreateEventsCentreInput {
  id?: string; workspaceId: string; tenantId: string;
  centreName: string; stateEventLicence?: string;
  fireSafetyCert?: string; lawmaCompliance?: string; cacRc?: string;
}

export interface CreateEventsCentreSectionInput {
  id?: string; profileId: string; tenantId: string;
  sectionName: string; capacityGuests: number; dailyRateKobo: number; amenities?: string;
}

export interface CreateEventsCentreBookingInput {
  id?: string; profileId: string; tenantId: string;
  clientPhone: string; sectionIds: string[]; eventType: string;
  startDate: number; endDate: number; totalNights: number;
  packageKobo: number; depositKobo: number; balanceKobo: number;
}
