/**
 * water-treatment.test.ts — Minimum 15 tests
 * NAFDAC gate; scaled integers (no floats); L2 cap; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidWaterTreatmentTransition,
  guardClaimedToNafdacVerified, guardScaledIntegerPh, guardScaledIntegerChlorine,
  guardL2AiCap, guardFractionalKobo,
} from './types.js';

describe('WaterTreatment FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidWaterTreatmentTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → nafdac_verified valid', () => {
    expect(isValidWaterTreatmentTransition('claimed', 'nafdac_verified')).toBe(true);
  });
  it('nafdac_verified → active valid', () => {
    expect(isValidWaterTreatmentTransition('nafdac_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid', () => {
    expect(isValidWaterTreatmentTransition('seeded', 'active')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidWaterTreatmentTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidWaterTreatmentTransition('suspended', 'active')).toBe(true);
  });
});

describe('NAFDAC water licence guard', () => {
  it('allows with valid licence', () => {
    expect(guardClaimedToNafdacVerified({ nafdacWaterLicence: 'NAFDAC/W/2024/001' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToNafdacVerified({ nafdacWaterLicence: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToNafdacVerified({ nafdacWaterLicence: '' }).allowed).toBe(false);
  });
});

describe('Scaled integer pH guard (pH×100 — NO floats)', () => {
  it('accepts pH 7.20 stored as 720', () => {
    expect(guardScaledIntegerPh(720).allowed).toBe(true);
  });
  it('accepts minimum pH 0 stored as 0', () => {
    expect(guardScaledIntegerPh(0).allowed).toBe(true);
  });
  it('accepts maximum pH 14 stored as 1400', () => {
    expect(guardScaledIntegerPh(1400).allowed).toBe(true);
  });
  it('rejects float pH', () => {
    expect(guardScaledIntegerPh(7.2).allowed).toBe(false);
  });
  it('rejects out of range pH (>1400)', () => {
    expect(guardScaledIntegerPh(1401).allowed).toBe(false);
  });
  it('rejects negative pH', () => {
    expect(guardScaledIntegerPh(-1).allowed).toBe(false);
  });
});

describe('Scaled integer chlorine guard (ppm×10 — NO floats)', () => {
  it('accepts 0.5 ppm stored as 5', () => {
    expect(guardScaledIntegerChlorine(5).allowed).toBe(true);
  });
  it('rejects float chlorine', () => {
    expect(guardScaledIntegerChlorine(0.5).allowed).toBe(false);
  });
  it('rejects negative chlorine', () => {
    expect(guardScaledIntegerChlorine(-1).allowed).toBe(false);
  });
});

describe('L2 AI cap', () => {
  it('blocks L3_HITL', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L3_HITL' }).allowed).toBe(false);
  });
  it('allows L2', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L2' }).allowed).toBe(true);
  });
});

describe('P9 kobo guard', () => {
  it('accepts valid rate', () => {
    expect(guardFractionalKobo(50_000).allowed).toBe(true);
  });
  it('rejects fractional', () => {
    expect(guardFractionalKobo(50_000.1).allowed).toBe(false);
  });
});
