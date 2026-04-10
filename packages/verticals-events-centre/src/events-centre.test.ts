/**
 * events-centre.test.ts — Minimum 15 tests
 * State licence gate; section conflict; L2 cap; P13; P9 kobo; total_nights integer
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEventsCentreTransition,
  guardClaimedToLicenceVerified, guardSectionConflict, guardL2AiCap,
  guardFractionalKobo,
} from './types.js';

describe('EventsCentre FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidEventsCentreTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → licence_verified valid', () => {
    expect(isValidEventsCentreTransition('claimed', 'licence_verified')).toBe(true);
  });
  it('licence_verified → active valid', () => {
    expect(isValidEventsCentreTransition('licence_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid', () => {
    expect(isValidEventsCentreTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid', () => {
    expect(isValidEventsCentreTransition('active', 'seeded')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidEventsCentreTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidEventsCentreTransition('suspended', 'active')).toBe(true);
  });
});

describe('State event licence guard', () => {
  it('allows valid licence', () => {
    expect(guardClaimedToLicenceVerified({ stateEventLicence: 'LG/EC/2024/001' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToLicenceVerified({ stateEventLicence: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToLicenceVerified({ stateEventLicence: '' }).allowed).toBe(false);
  });
});

describe('Section conflict guard', () => {
  it('allows booking when no conflict', () => {
    expect(guardSectionConflict({ conflictExists: false, sectionName: 'Ballroom' }).allowed).toBe(true);
  });
  it('blocks booking on conflicting section dates', () => {
    const result = guardSectionConflict({ conflictExists: true, sectionName: 'Ballroom' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Ballroom');
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
  it('allows numeric 1', () => {
    expect(guardL2AiCap({ autonomyLevel: 1 }).allowed).toBe(true);
  });
});

describe('P9 kobo guard', () => {
  it('accepts valid package cost', () => {
    expect(guardFractionalKobo(5_000_000).allowed).toBe(true);
  });
  it('accepts zero deposit', () => {
    expect(guardFractionalKobo(0).allowed).toBe(true);
  });
  it('rejects fractional', () => {
    expect(guardFractionalKobo(5_000_000.01).allowed).toBe(false);
  });
  it('rejects negative', () => {
    expect(guardFractionalKobo(-1).allowed).toBe(false);
  });
});
