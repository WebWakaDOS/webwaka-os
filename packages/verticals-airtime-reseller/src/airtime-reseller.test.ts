/**
 * airtime-reseller.test.ts — Minimum 15 tests
 * CBN daily cap; NCC verification; P13 no recipient_phone to AI; L2 cap; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidAirtimeResellerTransition,
  guardClaimedToNccVerified, guardCbnDailyCapKobo, guardL2AiCap,
  guardNoRecipientInAi, guardFractionalKobo,
} from './types.js';

describe('AirtimeReseller FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidAirtimeResellerTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → ncc_verified valid', () => {
    expect(isValidAirtimeResellerTransition('claimed', 'ncc_verified')).toBe(true);
  });
  it('ncc_verified → active valid', () => {
    expect(isValidAirtimeResellerTransition('ncc_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid (skip states)', () => {
    expect(isValidAirtimeResellerTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid (backward)', () => {
    expect(isValidAirtimeResellerTransition('active', 'seeded')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidAirtimeResellerTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid (reinstate)', () => {
    expect(isValidAirtimeResellerTransition('suspended', 'active')).toBe(true);
  });
});

describe('NCC dealer code guard', () => {
  it('allows with valid NCC code', () => {
    expect(guardClaimedToNccVerified({ nccDealerCode: 'NCC-2024-001' }).allowed).toBe(true);
  });
  it('blocks null NCC code', () => {
    expect(guardClaimedToNccVerified({ nccDealerCode: null }).allowed).toBe(false);
  });
  it('blocks empty string NCC code', () => {
    expect(guardClaimedToNccVerified({ nccDealerCode: '' }).allowed).toBe(false);
  });
});

describe('CBN daily cap guard', () => {
  it('allows within cap', () => {
    expect(guardCbnDailyCapKobo({ dailyUsedKobo: 1_000_000, amountKobo: 500_000 }).allowed).toBe(true);
  });
  it('blocks at cap exactly', () => {
    expect(guardCbnDailyCapKobo({ dailyUsedKobo: 30_000_000, amountKobo: 1 }).allowed).toBe(false);
  });
  it('blocks over custom cap', () => {
    expect(guardCbnDailyCapKobo({ dailyUsedKobo: 0, amountKobo: 1_000_001, dailyLimitKobo: 1_000_000 }).allowed).toBe(false);
  });
  it('allows under custom cap', () => {
    expect(guardCbnDailyCapKobo({ dailyUsedKobo: 0, amountKobo: 1_000_000, dailyLimitKobo: 1_000_000 }).allowed).toBe(true);
  });
});

describe('P13 no recipient_phone in AI', () => {
  it('blocks recipient_phone in AI payload', () => {
    expect(guardNoRecipientInAi({ recipient_phone: '08011112222', network: 'MTN' }).allowed).toBe(false);
  });
  it('blocks recipientPhone camelCase in AI payload', () => {
    expect(guardNoRecipientInAi({ recipientPhone: '08011112222' }).allowed).toBe(false);
  });
  it('allows aggregate-only payload', () => {
    expect(guardNoRecipientInAi({ network: 'MTN', total_kobo: 5_000_000, tx_count: 100 }).allowed).toBe(true);
  });
});

describe('L2 AI cap', () => {
  it('blocks L3_HITL', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L3_HITL' }).allowed).toBe(false);
  });
  it('blocks numeric level 3', () => {
    expect(guardL2AiCap({ autonomyLevel: 3 }).allowed).toBe(false);
  });
  it('allows L2 or lower', () => {
    expect(guardL2AiCap({ autonomyLevel: 'L2' }).allowed).toBe(true);
  });
});

describe('P9 kobo integer guard', () => {
  it('allows integer kobo', () => {
    expect(guardFractionalKobo(500_000).allowed).toBe(true);
  });
  it('allows zero kobo', () => {
    expect(guardFractionalKobo(0).allowed).toBe(true);
  });
  it('rejects fractional kobo', () => {
    expect(guardFractionalKobo(500_000.5).allowed).toBe(false);
  });
  it('rejects negative kobo', () => {
    expect(guardFractionalKobo(-1).allowed).toBe(false);
  });
});
