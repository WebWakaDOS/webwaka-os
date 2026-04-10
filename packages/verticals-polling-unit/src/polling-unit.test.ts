/**
 * polling-unit.test.ts — Minimum 15 tests
 * INEC accreditation gate; L3 HITL ALL AI; NO voter PII; integer vote counts
 */

import { describe, it, expect } from 'vitest';
import {
  isValidPollingUnitTransition,
  guardClaimedToInecAccredited, guardL3HitlRequired, guardNoVoterPiiInAi,
  guardIntegerVoteCount,
} from './types.js';

describe('PollingUnit FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidPollingUnitTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → inec_accredited valid', () => {
    expect(isValidPollingUnitTransition('claimed', 'inec_accredited')).toBe(true);
  });
  it('inec_accredited → active valid', () => {
    expect(isValidPollingUnitTransition('inec_accredited', 'active')).toBe(true);
  });
  it('seeded → active invalid', () => {
    expect(isValidPollingUnitTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid', () => {
    expect(isValidPollingUnitTransition('active', 'seeded')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidPollingUnitTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidPollingUnitTransition('suspended', 'active')).toBe(true);
  });
});

describe('INEC accreditation guard', () => {
  it('allows with valid accreditation', () => {
    expect(guardClaimedToInecAccredited({ inecAccreditation: 'INEC/OBS/2024/001' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToInecAccredited({ inecAccreditation: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToInecAccredited({ inecAccreditation: '' }).allowed).toBe(false);
  });
});

describe('L3 HITL MANDATORY for ALL AI (electoral)', () => {
  it('blocks when HITL not approved', () => {
    expect(guardL3HitlRequired({ hitlApproved: false }).allowed).toBe(false);
  });
  it('blocks when HITL undefined', () => {
    expect(guardL3HitlRequired({ hitlApproved: undefined }).allowed).toBe(false);
  });
  it('allows when HITL approved', () => {
    expect(guardL3HitlRequired({ hitlApproved: true }).allowed).toBe(true);
  });
});

describe('NO voter PII in AI (ABSOLUTE RULE)', () => {
  it('blocks voter_id', () => {
    expect(guardNoVoterPiiInAi({ voter_id: 'VR-123', unit_id: 'u1' }).allowed).toBe(false);
  });
  it('blocks voter_name', () => {
    expect(guardNoVoterPiiInAi({ voter_name: 'Aminu Ibrahim' }).allowed).toBe(false);
  });
  it('blocks party_votes breakdown', () => {
    expect(guardNoVoterPiiInAi({ party_votes: { APC: 1500, PDP: 900 } }).allowed).toBe(false);
  });
  it('blocks individual_result', () => {
    expect(guardNoVoterPiiInAi({ individual_result: 'candidate won' }).allowed).toBe(false);
  });
  it('allows aggregate count payload only', () => {
    expect(guardNoVoterPiiInAi({ unit_id: 'u1', registered_voters: 5000, accredited_count: 3200, votes_cast: 3100 }).allowed).toBe(true);
  });
});

describe('Integer vote count guard', () => {
  it('accepts 0 (pre-election)', () => {
    expect(guardIntegerVoteCount(0).allowed).toBe(true);
  });
  it('accepts 5000 votes', () => {
    expect(guardIntegerVoteCount(5000).allowed).toBe(true);
  });
  it('rejects float count', () => {
    expect(guardIntegerVoteCount(5000.5).allowed).toBe(false);
  });
  it('rejects negative count', () => {
    expect(guardIntegerVoteCount(-1).allowed).toBe(false);
  });
});
