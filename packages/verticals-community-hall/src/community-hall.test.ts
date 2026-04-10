/**
 * community-hall.test.ts — Minimum 15 tests
 * 3-state FSM; double-booking; L1 AI cap; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidCommunityHallTransition,
  guardDoubleBooking, guardL1AiCap, guardFractionalKobo,
} from './types.js';

describe('CommunityHall FSM (3-state)', () => {
  it('seeded → claimed valid', () => {
    expect(isValidCommunityHallTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → active valid', () => {
    expect(isValidCommunityHallTransition('claimed', 'active')).toBe(true);
  });
  it('seeded → active invalid (skip)', () => {
    expect(isValidCommunityHallTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid', () => {
    expect(isValidCommunityHallTransition('active', 'seeded')).toBe(false);
  });
  it('active → claimed invalid', () => {
    expect(isValidCommunityHallTransition('active', 'claimed')).toBe(false);
  });
  it('active → active invalid (self-loop)', () => {
    expect(isValidCommunityHallTransition('active', 'active')).toBe(false);
  });
  it('claimed → seeded invalid', () => {
    expect(isValidCommunityHallTransition('claimed', 'seeded')).toBe(false);
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

describe('L1 AI cap', () => {
  it('blocks L2', () => {
    expect(guardL1AiCap({ autonomyLevel: 'L2' }).allowed).toBe(false);
  });
  it('blocks L3_HITL', () => {
    expect(guardL1AiCap({ autonomyLevel: 'L3_HITL' }).allowed).toBe(false);
  });
  it('blocks numeric 2', () => {
    expect(guardL1AiCap({ autonomyLevel: 2 }).allowed).toBe(false);
  });
  it('blocks numeric 3', () => {
    expect(guardL1AiCap({ autonomyLevel: 3 }).allowed).toBe(false);
  });
  it('allows numeric 1', () => {
    expect(guardL1AiCap({ autonomyLevel: 1 }).allowed).toBe(true);
  });
  it('allows undefined (no AI call)', () => {
    expect(guardL1AiCap({ autonomyLevel: undefined }).allowed).toBe(true);
  });
});

describe('P9 kobo guard', () => {
  it('accepts zero hire fee (free community use)', () => {
    expect(guardFractionalKobo(0).allowed).toBe(true);
  });
  it('accepts positive fee', () => {
    expect(guardFractionalKobo(500_000).allowed).toBe(true);
  });
  it('rejects fractional', () => {
    expect(guardFractionalKobo(500_000.5).allowed).toBe(false);
  });
  it('rejects negative', () => {
    expect(guardFractionalKobo(-100).allowed).toBe(false);
  });
});
