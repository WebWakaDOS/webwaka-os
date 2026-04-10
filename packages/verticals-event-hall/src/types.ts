/**
 * @webwaka/verticals-event-hall — types + FSM guards (M10)
 * FSM: seeded → claimed → licence_verified → active → suspended
 * AI: L2 cap — venue utilisation report (aggregate by event type); no client details to AI (P13)
 * P9: all monetary values in kobo integers; capacity_guests INTEGER
 * Double-booking prevention enforced at route level
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 for booking deposits; Tier 3 for corporate contracts above ₦5M
 */

export type EventHallFSMState =
  | 'seeded'
  | 'claimed'
  | 'licence_verified'
  | 'active'
  | 'suspended';

export type BookingStatus = 'enquiry' | 'confirmed' | 'completed' | 'cancelled';

const FSM_TRANSITIONS: Record<EventHallFSMState, EventHallFSMState[]> = {
  seeded:           ['claimed'],
  claimed:          ['licence_verified'],
  licence_verified: ['active'],
  active:           ['suspended'],
  suspended:        ['active'],
};

export function isValidEventHallTransition(from: EventHallFSMState, to: EventHallFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToLicenceVerified(input: { stateEventLicence: string | null }): GuardResult {
  if (!input.stateEventLicence || input.stateEventLicence.trim() === '') {
    return { allowed: false, reason: 'State event licence required to verify event hall' };
  }
  return { allowed: true };
}

export function guardDoubleBooking(input: { existingBookingOnDate: boolean }): GuardResult {
  if (input.existingBookingOnDate) {
    return { allowed: false, reason: 'Event hall is already booked on this date' };
  }
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'Event hall AI capped at L2 advisory — venue utilisation aggregate only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'Event hall AI capped at L2' };
  }
  return { allowed: true };
}

export function guardNoClientDetailsInAi(payload: Record<string, unknown>): GuardResult {
  const forbidden = ['client_phone', 'clientPhone', 'client_name', 'clientName'];
  for (const key of forbidden) {
    if (key in payload) return { allowed: false, reason: `P13: client details "${key}" must not pass to AI` };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface EventHallProfile {
  id: string; workspaceId: string; tenantId: string;
  hallName: string; stateEventLicence: string | null;
  fireSafetyCert: string | null; cacRc: string | null; capacityGuests: number;
  status: EventHallFSMState; createdAt: number; updatedAt: number;
}

export interface HallBooking {
  id: string; profileId: string; tenantId: string;
  clientPhone: string; eventDate: number; eventType: string;
  capacityRequired: number; hireRateKobo: number; depositKobo: number; balanceKobo: number;
  addOns: string | null; status: BookingStatus;
  createdAt: number; updatedAt: number;
}

export interface HallBlockedDate {
  id: string; profileId: string; tenantId: string;
  blockedDate: number; reason: string | null;
  createdAt: number; updatedAt: number;
}

export interface CreateEventHallInput {
  id?: string; workspaceId: string; tenantId: string;
  hallName: string; stateEventLicence?: string; fireSafetyCert?: string;
  cacRc?: string; capacityGuests: number;
}

export interface CreateHallBookingInput {
  id?: string; profileId: string; tenantId: string;
  clientPhone: string; eventDate: number; eventType: string;
  capacityRequired: number; hireRateKobo: number; depositKobo: number; balanceKobo: number;
  addOns?: string;
}
