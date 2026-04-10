/**
 * newspaper-dist.test.ts — Minimum 15 tests
 * NPC gate; print run integer copies; advertiser P13; L2 cap; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidNewspaperDistTransition,
  guardClaimedToNpcVerified, guardIntegerPrintRun, guardL2AiCap,
  guardFractionalKobo,
} from './types.js';

describe('NewspaperDist FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidNewspaperDistTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → npc_verified valid', () => {
    expect(isValidNewspaperDistTransition('claimed', 'npc_verified')).toBe(true);
  });
  it('npc_verified → active valid', () => {
    expect(isValidNewspaperDistTransition('npc_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid', () => {
    expect(isValidNewspaperDistTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid', () => {
    expect(isValidNewspaperDistTransition('active', 'seeded')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidNewspaperDistTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidNewspaperDistTransition('suspended', 'active')).toBe(true);
  });
});

describe('NPC registration guard', () => {
  it('allows valid NPC registration', () => {
    expect(guardClaimedToNpcVerified({ npcRegistration: 'NPC/2024/001' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToNpcVerified({ npcRegistration: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToNpcVerified({ npcRegistration: '' }).allowed).toBe(false);
  });
});

describe('Integer print run guard (copies count)', () => {
  it('accepts 10000 copies', () => {
    expect(guardIntegerPrintRun(10_000).allowed).toBe(true);
  });
  it('accepts 1 copy', () => {
    expect(guardIntegerPrintRun(1).allowed).toBe(true);
  });
  it('rejects 0 copies', () => {
    expect(guardIntegerPrintRun(0).allowed).toBe(false);
  });
  it('rejects float copies', () => {
    expect(guardIntegerPrintRun(10_000.5).allowed).toBe(false);
  });
  it('rejects negative copies', () => {
    expect(guardIntegerPrintRun(-1).allowed).toBe(false);
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
  it('accepts valid ad fee', () => {
    expect(guardFractionalKobo(500_000).allowed).toBe(true);
  });
  it('rejects fractional', () => {
    expect(guardFractionalKobo(500_000.5).allowed).toBe(false);
  });
  it('rejects negative', () => {
    expect(guardFractionalKobo(-1).allowed).toBe(false);
  });
});
