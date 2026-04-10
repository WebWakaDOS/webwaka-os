/**
 * hire-purchase.test.ts — Minimum 15 tests
 * outstanding_kobo decrement; installments integer; BVN P13; L2 cap
 */

import { describe, it, expect } from 'vitest';
import {
  isValidHirePurchaseTransition,
  guardClaimedToCbnVerified, guardL2AiCap, guardNoBvnInAi,
  guardFractionalKobo, guardIntegerInstallments, guardOutstandingDecrement,
} from './types.js';

describe('HirePurchase FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidHirePurchaseTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → cbn_verified valid', () => {
    expect(isValidHirePurchaseTransition('claimed', 'cbn_verified')).toBe(true);
  });
  it('cbn_verified → active valid', () => {
    expect(isValidHirePurchaseTransition('cbn_verified', 'active')).toBe(true);
  });
  it('seeded → cbn_verified invalid (skip)', () => {
    expect(isValidHirePurchaseTransition('seeded', 'cbn_verified')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidHirePurchaseTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidHirePurchaseTransition('suspended', 'active')).toBe(true);
  });
});

describe('CBN consumer credit reg guard', () => {
  it('allows valid registration', () => {
    expect(guardClaimedToCbnVerified({ cbnConsumerCreditReg: 'CBN/CC/2024/001' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToCbnVerified({ cbnConsumerCreditReg: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToCbnVerified({ cbnConsumerCreditReg: '' }).allowed).toBe(false);
  });
});

describe('Integer installments guard', () => {
  it('accepts 12 installments', () => {
    expect(guardIntegerInstallments(12).allowed).toBe(true);
  });
  it('rejects 0 installments', () => {
    expect(guardIntegerInstallments(0).allowed).toBe(false);
  });
  it('rejects float installments', () => {
    expect(guardIntegerInstallments(12.5).allowed).toBe(false);
  });
  it('rejects negative installments', () => {
    expect(guardIntegerInstallments(-1).allowed).toBe(false);
  });
});

describe('Outstanding decrement guard', () => {
  it('allows payment less than outstanding', () => {
    expect(guardOutstandingDecrement({ outstandingKobo: 100_000, paymentKobo: 50_000 }).allowed).toBe(true);
  });
  it('allows exact final payment', () => {
    expect(guardOutstandingDecrement({ outstandingKobo: 50_000, paymentKobo: 50_000 }).allowed).toBe(true);
  });
  it('blocks overpayment', () => {
    expect(guardOutstandingDecrement({ outstandingKobo: 50_000, paymentKobo: 50_001 }).allowed).toBe(false);
  });
});

describe('P13 no BVN in AI', () => {
  it('blocks customer_bvn_ref', () => {
    expect(guardNoBvnInAi({ customer_bvn_ref: 'abc123', asset_type: 'motorcycle' }).allowed).toBe(false);
  });
  it('allows aggregate payload', () => {
    expect(guardNoBvnInAi({ asset_type: 'motorcycle', total_agreements: 50 }).allowed).toBe(true);
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
  it('accepts valid HP value', () => {
    expect(guardFractionalKobo(2_000_000).allowed).toBe(true);
  });
  it('rejects fractional value', () => {
    expect(guardFractionalKobo(500.5).allowed).toBe(false);
  });
});
