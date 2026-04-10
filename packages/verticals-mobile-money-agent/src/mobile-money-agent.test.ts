/**
 * mobile-money-agent.test.ts — Minimum 15 tests
 * CBN daily cap; BVN P13; L2 cap; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidMobileMoneyAgentTransition,
  guardClaimedToCbnAgentVerified, guardDailyCapKobo, guardL2AiCap,
  guardNoBvnInAi, guardFractionalKobo,
} from './types.js';

describe('MobileMoneyAgent FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidMobileMoneyAgentTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → cbn_agent_verified valid', () => {
    expect(isValidMobileMoneyAgentTransition('claimed', 'cbn_agent_verified')).toBe(true);
  });
  it('cbn_agent_verified → active valid', () => {
    expect(isValidMobileMoneyAgentTransition('cbn_agent_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid (skip)', () => {
    expect(isValidMobileMoneyAgentTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid (backward)', () => {
    expect(isValidMobileMoneyAgentTransition('active', 'seeded')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidMobileMoneyAgentTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidMobileMoneyAgentTransition('suspended', 'active')).toBe(true);
  });
});

describe('CBN sub-agent number guard', () => {
  it('allows with valid sub-agent number', () => {
    expect(guardClaimedToCbnAgentVerified({ cbnSubAgentNumber: 'MMA/CBN/2024/001' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToCbnAgentVerified({ cbnSubAgentNumber: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToCbnAgentVerified({ cbnSubAgentNumber: '' }).allowed).toBe(false);
  });
});

describe('CBN daily cap guard', () => {
  it('allows within cap', () => {
    expect(guardDailyCapKobo({ dailyUsedKobo: 0, amountKobo: 5_000_000, dailyLimitKobo: 30_000_000 }).allowed).toBe(true);
  });
  it('allows exactly at cap', () => {
    expect(guardDailyCapKobo({ dailyUsedKobo: 0, amountKobo: 30_000_000, dailyLimitKobo: 30_000_000 }).allowed).toBe(true);
  });
  it('blocks over cap', () => {
    expect(guardDailyCapKobo({ dailyUsedKobo: 30_000_000, amountKobo: 1, dailyLimitKobo: 30_000_000 }).allowed).toBe(false);
  });
  it('blocks when accumulated usage exceeds cap', () => {
    expect(guardDailyCapKobo({ dailyUsedKobo: 29_000_000, amountKobo: 1_500_000, dailyLimitKobo: 30_000_000 }).allowed).toBe(false);
  });
});

describe('P13 no BVN in AI', () => {
  it('blocks customer_bvn_ref', () => {
    expect(guardNoBvnInAi({ customer_bvn_ref: 'hash_xyz', transaction_type: 'cash_in' }).allowed).toBe(false);
  });
  it('blocks bvn key', () => {
    expect(guardNoBvnInAi({ bvn: '22222222222' }).allowed).toBe(false);
  });
  it('allows aggregate payload', () => {
    expect(guardNoBvnInAi({ transaction_type: 'cash_out', total_kobo: 10_000_000 }).allowed).toBe(true);
  });
});

describe('L2 AI cap', () => {
  it('blocks L3_HITL', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L3_HITL' }).allowed).toBe(false);
  });
  it('allows L2', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L2' }).allowed).toBe(true);
  });
  it('blocks numeric 3', () => {
    expect(guardL2AiCap({ autonomyLevel: 3 }).allowed).toBe(false);
  });
});

describe('P9 kobo guard', () => {
  it('accepts valid amount', () => {
    expect(guardFractionalKobo(10_000).allowed).toBe(true);
  });
  it('rejects fractional', () => {
    expect(guardFractionalKobo(10_000.25).allowed).toBe(false);
  });
  it('rejects negative', () => {
    expect(guardFractionalKobo(-100).allowed).toBe(false);
  });
});
