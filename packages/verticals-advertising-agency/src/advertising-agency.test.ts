/**
 * advertising-agency.test.ts — Minimum 15 tests
 * APCON gate; impressions INTEGER; CPM INTEGER; client brief P13; L2 cap; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidAdvertisingAgencyTransition,
  guardClaimedToApconVerified, guardL2AiCap, guardNoClientBriefInAi,
  guardFractionalKobo, guardIntegerImpressions,
} from './types.js';

describe('AdvertisingAgency FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidAdvertisingAgencyTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → apcon_verified valid', () => {
    expect(isValidAdvertisingAgencyTransition('claimed', 'apcon_verified')).toBe(true);
  });
  it('apcon_verified → active valid', () => {
    expect(isValidAdvertisingAgencyTransition('apcon_verified', 'active')).toBe(true);
  });
  it('seeded → active invalid (skip)', () => {
    expect(isValidAdvertisingAgencyTransition('seeded', 'active')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidAdvertisingAgencyTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidAdvertisingAgencyTransition('suspended', 'active')).toBe(true);
  });
});

describe('APCON registration guard', () => {
  it('allows with APCON registration', () => {
    expect(guardClaimedToApconVerified({ apconRegistration: 'APCON/2024/001' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToApconVerified({ apconRegistration: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToApconVerified({ apconRegistration: '' }).allowed).toBe(false);
  });
});

describe('Integer impressions guard', () => {
  it('accepts 1000000 impressions', () => {
    expect(guardIntegerImpressions(1_000_000).allowed).toBe(true);
  });
  it('accepts 0 impressions (new campaign)', () => {
    expect(guardIntegerImpressions(0).allowed).toBe(true);
  });
  it('rejects float impressions', () => {
    expect(guardIntegerImpressions(1_000_000.5).allowed).toBe(false);
  });
  it('rejects negative impressions', () => {
    expect(guardIntegerImpressions(-1).allowed).toBe(false);
  });
});

describe('P13 no client brief in AI', () => {
  it('blocks client_ref_id', () => {
    expect(guardNoClientBriefInAi({ client_ref_id: 'uuid', campaign_type: 'TV' }).allowed).toBe(false);
  });
  it('blocks creative_brief', () => {
    expect(guardNoClientBriefInAi({ creative_brief: 'Launch FMG product X with celebrity endorsement' }).allowed).toBe(false);
  });
  it('allows aggregate performance payload', () => {
    expect(guardNoClientBriefInAi({ campaign_type: 'digital', total_impressions: 5_000_000, avg_cpm_kobo: 500 }).allowed).toBe(true);
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
  it('accepts valid budget', () => {
    expect(guardFractionalKobo(50_000_000).allowed).toBe(true);
  });
  it('rejects fractional budget', () => {
    expect(guardFractionalKobo(50_000_000.01).allowed).toBe(false);
  });
});
