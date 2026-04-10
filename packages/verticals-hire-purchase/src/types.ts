/**
 * @webwaka/verticals-hire-purchase — types + FSM guards (M12)
 * FSM: seeded → claimed → cbn_verified → active → suspended
 * AI: L2 cap — repayment collection forecast (aggregate only); no customer BVN ref to AI (P13)
 * P9: all monetary values in kobo integers; installments INTEGER; tenor_months INTEGER
 * P13: customer_bvn_ref hashed — never to AI
 * T3: all queries scoped to tenant_id
 * KYC: Tier 3 mandatory — consumer credit operations
 */

export type HirePurchaseFSMState =
  | 'seeded'
  | 'claimed'
  | 'cbn_verified'
  | 'active'
  | 'suspended';

export type AssetType = 'motorcycle' | 'electronics' | 'agricultural_equipment';
export type AssetStatus = 'available' | 'on_hp' | 'repossessed';
export type AgreementStatus = 'active' | 'completed' | 'defaulted' | 'repossessed';

const FSM_TRANSITIONS: Record<HirePurchaseFSMState, HirePurchaseFSMState[]> = {
  seeded:      ['claimed'],
  claimed:     ['cbn_verified'],
  cbn_verified: ['active'],
  active:      ['suspended'],
  suspended:   ['active'],
};

export function isValidHirePurchaseTransition(from: HirePurchaseFSMState, to: HirePurchaseFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToCbnVerified(input: { cbnConsumerCreditReg: string | null }): GuardResult {
  if (!input.cbnConsumerCreditReg || input.cbnConsumerCreditReg.trim() === '') {
    return { allowed: false, reason: 'CBN consumer credit registration required to verify hire purchase operator' };
  }
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'HP AI capped at L2 advisory — repayment collection aggregate only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'HP AI capped at L2' };
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

export function guardIntegerInstallments(n: number): GuardResult {
  if (!Number.isInteger(n) || n <= 0) return { allowed: false, reason: 'installments must be a positive integer' };
  return { allowed: true };
}

export function guardOutstandingDecrement(input: {
  outstandingKobo: number; paymentKobo: number;
}): GuardResult {
  if (input.paymentKobo > input.outstandingKobo) {
    return { allowed: false, reason: `Payment (${input.paymentKobo} kobo) exceeds outstanding balance (${input.outstandingKobo} kobo)` };
  }
  return { allowed: true };
}

export interface HirePurchaseProfile {
  id: string; workspaceId: string; tenantId: string;
  companyName: string; cbnConsumerCreditReg: string | null; cacRc: string | null;
  status: HirePurchaseFSMState; createdAt: number; updatedAt: number;
}

export interface HpAsset {
  id: string; profileId: string; tenantId: string;
  assetType: AssetType; serialNumber: string; assetValueKobo: number;
  status: AssetStatus; createdAt: number; updatedAt: number;
}

export interface HpAgreement {
  id: string; profileId: string; tenantId: string;
  customerBvnRef: string; assetId: string;
  totalHpValueKobo: number; depositKobo: number;
  installments: number; installmentAmountKobo: number; tenorMonths: number;
  startDate: number; outstandingKobo: number; status: AgreementStatus;
  createdAt: number; updatedAt: number;
}

export interface HpRepayment {
  id: string; agreementId: string; tenantId: string;
  paymentDate: number; amountKobo: number; outstandingAfterKobo: number;
  createdAt: number; updatedAt: number;
}

export interface CreateHirePurchaseInput {
  id?: string; workspaceId: string; tenantId: string;
  companyName: string; cbnConsumerCreditReg?: string; cacRc?: string;
}

export interface CreateHpAssetInput {
  id?: string; profileId: string; tenantId: string;
  assetType: AssetType; serialNumber: string; assetValueKobo: number;
}

export interface CreateHpAgreementInput {
  id?: string; profileId: string; tenantId: string;
  customerBvnRef: string; assetId: string;
  totalHpValueKobo: number; depositKobo: number;
  installments: number; installmentAmountKobo: number; tenorMonths: number; startDate: number;
}

export interface CreateHpRepaymentInput {
  id?: string; agreementId: string; tenantId: string;
  paymentDate: number; amountKobo: number;
}
