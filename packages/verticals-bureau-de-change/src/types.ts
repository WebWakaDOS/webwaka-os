/**
 * @webwaka/verticals-bureau-de-change — types + FSM guards (M12)
 * FSM: seeded → claimed → cbn_verified → active → suspended
 * AI: L2 cap — FX position trend (aggregate volume by direction only); NO rate suggestions; no BVN ref to AI (P13)
 * P9: naira amounts in kobo integers; USD amounts in integer cents; rates as integer kobo per USD cent
 * CRITICAL: FX rates NEVER stored as floats — always kobo per USD cent
 * T3: all queries scoped to tenant_id
 * KYC: Tier 3 mandatory — FX dealing is regulated financial activity
 */

export type BdcFSMState =
  | 'seeded'
  | 'claimed'
  | 'cbn_verified'
  | 'active'
  | 'suspended';

export type FxCurrency = 'USD' | 'EUR' | 'GBP' | 'CNY';
export type FxDirection = 'buy' | 'sell';
export type BdcTransactionStatus = 'completed' | 'reversed';

const FSM_TRANSITIONS: Record<BdcFSMState, BdcFSMState[]> = {
  seeded:      ['claimed'],
  claimed:     ['cbn_verified'],
  cbn_verified: ['active'],
  active:      ['suspended'],
  suspended:   ['active'],
};

export function isValidBdcTransition(from: BdcFSMState, to: BdcFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToCbnVerified(input: { cbnBdcLicence: string | null }): GuardResult {
  if (!input.cbnBdcLicence || input.cbnBdcLicence.trim() === '') {
    return { allowed: false, reason: 'CBN BDC licence required to verify bureau de change' };
  }
  return { allowed: true };
}

export function guardIntegerFxRate(rate: number): GuardResult {
  if (!Number.isInteger(rate) || rate <= 0) {
    return { allowed: false, reason: 'FX rate must be a positive integer (kobo per USD cent — no floats)' };
  }
  return { allowed: true };
}

export function guardIntegerCents(cents: number): GuardResult {
  if (!Number.isInteger(cents) || cents <= 0) {
    return { allowed: false, reason: 'USD amount must be a positive integer in cents (no floats)' };
  }
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'BDC AI capped at L2 — FX position aggregate only; NO automated rate suggestions (CBN regulated)' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'BDC AI capped at L2' };
  }
  return { allowed: true };
}

export function guardNoBvnInAi(payload: Record<string, unknown>): GuardResult {
  const forbidden = ['customer_bvn_ref', 'customerBvnRef', 'bvn'];
  for (const key of forbidden) {
    if (key in payload) return { allowed: false, reason: `P13: customer BVN ref must not pass to AI` };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface BdcProfile {
  id: string; workspaceId: string; tenantId: string;
  companyName: string; cbnBdcLicence: string | null;
  abconMembership: string | null; cbnTier: number | null; cacRc: string | null;
  status: BdcFSMState; createdAt: number; updatedAt: number;
}

export interface BdcRate {
  id: string; profileId: string; tenantId: string;
  rateDate: number; currency: FxCurrency;
  buyRateKoboPerCent: number; sellRateKoboPerCent: number;
  createdAt: number; updatedAt: number;
}

export interface BdcTransaction {
  id: string; profileId: string; tenantId: string;
  customerBvnRef: string; currency: FxCurrency;
  usdAmountCents: number; nairaAmountKobo: number;
  direction: FxDirection; transactionDate: number;
  efccReportRequired: boolean; status: BdcTransactionStatus;
  createdAt: number; updatedAt: number;
}

export interface CreateBdcInput {
  id?: string; workspaceId: string; tenantId: string;
  companyName: string; cbnBdcLicence?: string;
  abconMembership?: string; cbnTier?: number; cacRc?: string;
}

export interface CreateBdcRateInput {
  id?: string; profileId: string; tenantId: string;
  rateDate: number; currency: FxCurrency;
  buyRateKoboPerCent: number; sellRateKoboPerCent: number;
}

export interface CreateBdcTransactionInput {
  id?: string; profileId: string; tenantId: string;
  customerBvnRef: string; currency: FxCurrency;
  usdAmountCents: number; nairaAmountKobo: number;
  direction: FxDirection; transactionDate: number;
}
