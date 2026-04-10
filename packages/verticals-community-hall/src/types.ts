/**
 * @webwaka/verticals-community-hall — types + FSM guards (M12)
 * FSM: seeded → claimed → active  (3-STATE — community halls are informal civic infrastructure)
 * AI: L1 cap — venue utilisation report (aggregate booking frequency by event type); no client details to AI (P13)
 * P9: all monetary values in kobo integers; capacity_seats INTEGER
 * Double-booking prevention enforced at route level
 * T3: all queries scoped to tenant_id
 * KYC: Tier 1 sufficient for informal community use
 */

export type CommunityHallFSMState =
  | 'seeded'
  | 'claimed'
  | 'active';

export type BookingStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled';

const FSM_TRANSITIONS: Record<CommunityHallFSMState, CommunityHallFSMState[]> = {
  seeded:  ['claimed'],
  claimed: ['active'],
  active:  [],
};

export function isValidCommunityHallTransition(from: CommunityHallFSMState, to: CommunityHallFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardDoubleBooking(input: { existingBookingOnDate: boolean }): GuardResult {
  if (input.existingBookingOnDate) {
    return { allowed: false, reason: 'Community hall already has a booking on this date' };
  }
  return { allowed: true };
}

export function guardL1AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 1) {
    return { allowed: false, reason: 'Community hall AI capped at L1 advisory — booking frequency aggregate only' };
  }
  if (input.autonomyLevel === 'L2' || input.autonomyLevel === 'L3_HITL') {
    return { allowed: false, reason: 'Community hall AI capped at L1' };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface CommunityHallProfile {
  id: string; workspaceId: string; tenantId: string;
  hallName: string; cdaRegistration: string | null; lga: string; state: string;
  capacitySeats: number; status: CommunityHallFSMState;
  createdAt: number; updatedAt: number;
}

export interface CommunityHallBooking {
  id: string; profileId: string; tenantId: string;
  groupName: string; eventType: string; bookingDate: number;
  hireFeeKobo: number; depositKobo: number; status: BookingStatus;
  createdAt: number; updatedAt: number;
}

export interface CommunityHallMaintenance {
  id: string; profileId: string; tenantId: string;
  contributionDate: number; contributorRef: string;
  amountKobo: number; purpose: string | null;
  createdAt: number; updatedAt: number;
}

export interface CreateCommunityHallInput {
  id?: string; workspaceId: string; tenantId: string;
  hallName: string; cdaRegistration?: string; lga: string; state: string; capacitySeats: number;
}

export interface CreateCommunityHallBookingInput {
  id?: string; profileId: string; tenantId: string;
  groupName: string; eventType: string; bookingDate: number;
  hireFeeKobo: number; depositKobo: number;
}

export interface CreateCommunityHallMaintenanceInput {
  id?: string; profileId: string; tenantId: string;
  contributionDate: number; contributorRef: string; amountKobo: number; purpose?: string;
}
