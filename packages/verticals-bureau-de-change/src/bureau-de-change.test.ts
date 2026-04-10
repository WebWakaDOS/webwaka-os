/**
 * bureau-de-change.test.ts — Minimum 15 tests
 * FX rates as kobo/cent integers (no floats); USD as cents; BVN ref P13; L2 cap
 */

import { describe, it, expect } from 'vitest';
import {
  isValidBdcTransition,
  guardClaimedToCbnVerified, guardIntegerFxRate, guardIntegerCents,
  guardL2AiCap, guardNoBvnInAi, guardFractionalKobo,
} from './types.js';

describe('BDC FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidBdcTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → cbn_verified valid', () => {
    expect(isValidBdcTransition('claimed', 'cbn_verified')).toBe(true);
  });
  it('cbn_verified → active valid', () => {
    expect(isValidBdcTransition('cbn_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid', () => {
    expect(isValidBdcTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid', () => {
    expect(isValidBdcTransition('active', 'seeded')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidBdcTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidBdcTransition('suspended', 'active')).toBe(true);
  });
});

describe('CBN BDC licence guard', () => {
  it('allows valid licence', () => {
    expect(guardClaimedToCbnVerified({ cbnBdcLicence: 'CBN/BDC/2024/001' }).allowed).toBe(true);
  });
  it('blocks null licence', () => {
    expect(guardClaimedToCbnVerified({ cbnBdcLicence: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToCbnVerified({ cbnBdcLicence: '' }).allowed).toBe(false);
  });
});

describe('FX rate integer guard (kobo per USD cent — NO floats)', () => {
  it('accepts valid integer rate (e.g., 160000 = ₦1600.00 per $1)', () => {
    expect(guardIntegerFxRate(160000).allowed).toBe(true);
  });
  it('rejects float rate', () => {
    expect(guardIntegerFxRate(1600.5).allowed).toBe(false);
  });
  it('rejects zero rate', () => {
    expect(guardIntegerFxRate(0).allowed).toBe(false);
  });
  it('rejects negative rate', () => {
    expect(guardIntegerFxRate(-160000).allowed).toBe(false);
  });
});

describe('USD cents integer guard (NO floats)', () => {
  it('accepts 100000 cents ($1000)', () => {
    expect(guardIntegerCents(100000).allowed).toBe(true);
  });
  it('rejects float cents', () => {
    expect(guardIntegerCents(100000.5).allowed).toBe(false);
  });
  it('rejects zero cents', () => {
    expect(guardIntegerCents(0).allowed).toBe(false);
  });
});

describe('P13 no BVN in AI', () => {
  it('blocks customer_bvn_ref', () => {
    expect(guardNoBvnInAi({ customer_bvn_ref: 'hash_abc', direction: 'buy' }).allowed).toBe(false);
  });
  it('blocks bvn key', () => {
    expect(guardNoBvnInAi({ bvn: '12345678901' }).allowed).toBe(false);
  });
  it('allows aggregate payload', () => {
    expect(guardNoBvnInAi({ currency: 'USD', direction: 'buy', volume_cents: 500000 }).allowed).toBe(true);
  });
});

describe('L2 AI cap', () => {
  it('blocks L3_HITL', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L3_HITL' }).allowed).toBe(false);
  });
  it('allows L2', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L2' }).allowed).toBe(true);
  });
  it('allows numeric 1', () => {
    expect(guardL2AiCap({ autonomyLevel: 1 }).allowed).toBe(true);
  });
});

describe('P9 kobo guard', () => {
  it('allows integer naira kobo', () => {
    expect(guardFractionalKobo(1_600_000_000).allowed).toBe(true);
  });
  it('rejects fractional kobo', () => {
    expect(guardFractionalKobo(1.5).allowed).toBe(false);
  });
});
