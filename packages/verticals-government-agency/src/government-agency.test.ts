/**
 * government-agency.test.ts — Minimum 15 tests
 * BPP gate; L3 HITL MANDATORY ALL AI; vendor/procurement P13; P9 kobo
 */

import { describe, it, expect } from 'vitest';
import {
  isValidGovernmentAgencyTransition,
  guardClaimedToBppRegistered, guardL3HitlRequired, guardNoVendorOrProcurementInAi,
  guardFractionalKobo,
} from './types.js';

describe('GovernmentAgency FSM', () => {
  it('seeded → claimed valid', () => {
    expect(isValidGovernmentAgencyTransition('seeded', 'claimed')).toBe(true);
  });
  it('claimed → bpp_registered valid', () => {
    expect(isValidGovernmentAgencyTransition('claimed', 'bpp_registered')).toBe(true);
  });
  it('bpp_registered → active valid', () => {
    expect(isValidGovernmentAgencyTransition('bpp_registered', 'active')).toBe(true);
  });
  it('seeded → active invalid', () => {
    expect(isValidGovernmentAgencyTransition('seeded', 'active')).toBe(false);
  });
  it('active → seeded invalid', () => {
    expect(isValidGovernmentAgencyTransition('active', 'seeded')).toBe(false);
  });
  it('active → suspended valid', () => {
    expect(isValidGovernmentAgencyTransition('active', 'suspended')).toBe(true);
  });
  it('suspended → active valid', () => {
    expect(isValidGovernmentAgencyTransition('suspended', 'active')).toBe(true);
  });
});

describe('BPP registration guard', () => {
  it('allows with valid BPP registration', () => {
    expect(guardClaimedToBppRegistered({ bppRegistration: 'BPP/MDA/2024/001' }).allowed).toBe(true);
  });
  it('blocks null', () => {
    expect(guardClaimedToBppRegistered({ bppRegistration: null }).allowed).toBe(false);
  });
  it('blocks empty string', () => {
    expect(guardClaimedToBppRegistered({ bppRegistration: '' }).allowed).toBe(false);
  });
});

describe('L3 HITL MANDATORY for ALL AI', () => {
  it('blocks when HITL not approved', () => {
    expect(guardL3HitlRequired({ hitlApproved: false }).allowed).toBe(false);
  });
  it('blocks when HITL undefined', () => {
    expect(guardL3HitlRequired({ hitlApproved: undefined }).allowed).toBe(false);
  });
  it('allows when HITL explicitly approved', () => {
    expect(guardL3HitlRequired({ hitlApproved: true }).allowed).toBe(true);
  });
});

describe('P13 no vendor/procurement data in AI', () => {
  it('blocks vendor_ref', () => {
    expect(guardNoVendorOrProcurementInAi({ vendor_ref: 'VENDOR-001', category: 'goods' }).allowed).toBe(false);
  });
  it('blocks procurement_ref', () => {
    expect(guardNoVendorOrProcurementInAi({ procurement_ref: 'PROC-2024-001' }).allowed).toBe(false);
  });
  it('blocks budget_line_item', () => {
    expect(guardNoVendorOrProcurementInAi({ budget_line_item: 'Capital Expenditure' }).allowed).toBe(false);
  });
  it('blocks bpp_approval_ref', () => {
    expect(guardNoVendorOrProcurementInAi({ bpp_approval_ref: 'BPP/APP/2024/001' }).allowed).toBe(false);
  });
  it('allows aggregate spend payload', () => {
    expect(guardNoVendorOrProcurementInAi({ category: 'services', total_spend_kobo: 50_000_000, count: 12 }).allowed).toBe(true);
  });
});

describe('P9 kobo guard', () => {
  it('accepts valid appropriation amount', () => {
    expect(guardFractionalKobo(1_000_000_000).allowed).toBe(true);
  });
  it('rejects fractional', () => {
    expect(guardFractionalKobo(1_000_000_000.5).allowed).toBe(false);
  });
  it('rejects negative', () => {
    expect(guardFractionalKobo(-1).allowed).toBe(false);
  });
});
