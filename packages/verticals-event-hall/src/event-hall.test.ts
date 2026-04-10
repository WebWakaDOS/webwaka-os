/**
 * event-hall.test.ts — Minimum 15 tests
 * State licence gate; double-booking prevention; L2 cap; P13; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEventHallTransition,
  guardClaimedToLicenceVerified, guardDoubleBooking, guardL2AiCap,
  guardNoClientDetailsInAi, guardFractionalKobo,
} from './types.js';

describe('EventHall FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidEventHallTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → licence_verified valid', () => {
    expect(isValidEventHallTransition('claimed', 'licence_verified')).toBe(true);
  });
  it('licence_verified → active valid', () => {
    expect(isValidEventHallTransition('licence_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid (skip)', () => {
    expect(isValidEventHallTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid', () => {
    expect(isValidEventHallTransition('active', 'seeded')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidEventHallTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidEventHallTransition('suspended', 'active')).toBe(true);
  });
});

describe('State event licence guard', () => {
  it('allows with valid licence', () => {
    expect(guardClaimedToLicenceVerified({ stateEventLicence: 'LG/EV/2024/001' }).allowed).toBe(true);
  });
  it('blocks null licence', () => {
    expect(guardClaimedToLicenceVerified({ stateEventLicence: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToLicenceVerified({ stateEventLicence: '' }).allowed).toBe(false);
  });
});

describe('Double-booking prevention', () => {
  it('allows booking on free date', () => {
    expect(guardDoubleBooking({ existingBookingOnDate: false }).allowed).toBe(true);
  });
  it('blocks booking on occupied date', () => {
    expect(guardDoubleBooking({ existingBookingOnDate: true }).allowed).toBe(false);
  });
});

describe('P13 no client details in AI', () => {
  it('blocks client_phone', () => {
    expect(guardNoClientDetailsInAi({ client_phone: '08022223333', event_type: 'wedding' }).allowed).toBe(false);
  });
  it('blocks clientPhone camelCase', () => {
    expect(guardNoClientDetailsInAi({ clientPhone: '08022223333' }).allowed).toBe(false);
  });
  it('allows aggregate event type payload', () => {
    expect(guardNoClientDetailsInAi({ event_type: 'wedding', booking_count: 12 }).allowed).toBe(true);
  });
});

describe('L2 AI cap', () => {
  it('blocks L3_HITL', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L3_HITL' }).allowed).toBe(false);
  });
  it('blocks numeric 3', () => {
    expect(guardL2AiCap({ autonomyLevel: 3 }).allowed).toBe(false);
  });
  it('allows L2', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L2' }).allowed).toBe(true);
  });
  it('allows numeric 2', () => {
    expect(guardL2AiCap({ autonomyLevel: 2 }).allowed).toBe(true);
  });
});

describe('P9 kobo guard', () => {
  it('accepts valid hire rate', () => {
    expect(guardFractionalKobo(3_000_000).allowed).toBe(true);
  });
  it('rejects fractional rate', () => {
    expect(guardFractionalKobo(3_000_000.01).allowed).toBe(false);
  });
  it('rejects negative', () => {
    expect(guardFractionalKobo(-1).allowed).toBe(false);
  });
});
