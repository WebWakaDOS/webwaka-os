/**
 * podcast-studio.test.ts — Minimum 15 tests
 * CAC gate; L3 HITL for broadcast scheduling; L2 for sponsorship; guest/sponsor P13; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidPodcastStudioTransition,
  guardClaimedToCacVerified, guardL3HitlRequired, guardL2AiCapSponsorship,
  guardNoGuestSponsorInAi, guardFractionalKobo,
} from './types.js';

describe('PodcastStudio FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidPodcastStudioTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → cac_verified valid', () => {
    expect(isValidPodcastStudioTransition('claimed', 'cac_verified')).toBe(true);
  });
  it('cac_verified → active valid', () => {
    expect(isValidPodcastStudioTransition('cac_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid', () => {
    expect(isValidPodcastStudioTransition('seeded', 'active')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidPodcastStudioTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidPodcastStudioTransition('suspended', 'active')).toBe(true);
  });
});

describe('CAC RC guard', () => {
  it('allows with valid CAC RC', () => {
    expect(guardClaimedToCacVerified({ cacRc: 'RC-1234567' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToCacVerified({ cacRc: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToCacVerified({ cacRc: '' }).allowed).toBe(false);
  });
});

describe('L3 HITL required for broadcast scheduling', () => {
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

describe('L2 cap for sponsorship revenue AI', () => {
  it('blocks L3_HITL for sponsorship (must be L2)', () => {
    expect(guardL2AiCapSponsorship({ autonomyLevel: 'L3_HITL' }).allowed).toBe(false);
  });
  it('allows L2 for sponsorship', () => {
    expect(guardL2AiCapSponsorship({ autonomyLevel: 'L2' }).allowed).toBe(true);
  });
  it('allows L1 for sponsorship', () => {
    expect(guardL2AiCapSponsorship({ autonomyLevel: 1 }).allowed).toBe(true);
  });
});

describe('P13 no guest/sponsor in AI', () => {
  it('blocks guest_ref_id', () => {
    expect(guardNoGuestSponsorInAi({ guest_ref_id: 'uuid', show_id: 'show1' }).allowed).toBe(false);
  });
  it('blocks sponsor_ref_id', () => {
    expect(guardNoGuestSponsorInAi({ sponsor_ref_id: 'sponsor_uuid' }).allowed).toBe(false);
  });
  it('allows aggregate revenue payload', () => {
    expect(guardNoGuestSponsorInAi({ show_id: 'show1', total_revenue_kobo: 2_000_000, episode_count: 24 }).allowed).toBe(true);
  });
});

describe('P9 kobo guard', () => {
  it('accepts valid session fee', () => {
    expect(guardFractionalKobo(250_000).allowed).toBe(true);
  });
  it('rejects fractional fee', () => {
    expect(guardFractionalKobo(250_000.5).allowed).toBe(false);
  });
  it('rejects negative fee', () => {
    expect(guardFractionalKobo(-1).allowed).toBe(false);
  });
});
