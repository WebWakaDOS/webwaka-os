/**
 * @webwaka/verticals-mobile-money-agent — types + FSM guards (M12)
 * FSM: seeded → claimed → cbn_agent_verified → active → suspended
 * AI: L2 cap — daily float utilisation trend (aggregate only); no customer BVN ref to AI (P13)
 * P9: all monetary values in kobo integers
 * CBN sub-agent daily cap: 30,000,000 kobo default (₦300,000); enforced at route level
 * P13: customer_bvn_ref hashed — never to AI
 * T3: all queries scoped to tenant_id
 * KYC: Tier 3 mandatory — agent banking = regulated financial intermediation
 * NOTE: Standard transaction routes CAN be USSD; only AI advisory blocked on USSD (P12)
 */

export type MobileMoneyAgentFSMState =
  | 'seeded'
  | 'claimed'
  | 'cbn_agent_verified'
  | 'active'
  | 'suspended';

export type MmTransactionType = 'cash_in' | 'cash_out' | 'transfer' | 'bill' | 'airtime';
export type MmTransactionStatus = 'completed' | 'failed' | 'reversed';

const FSM_TRANSITIONS: Record<MobileMoneyAgentFSMState, MobileMoneyAgentFSMState[]> = {
  seeded:             ['claimed'],
  claimed:            ['cbn_agent_verified'],
  cbn_agent_verified: ['active'],
  active:             ['suspended'],
  suspended:          ['active'],
};

export function isValidMobileMoneyAgentTransition(from: MobileMoneyAgentFSMState, to: MobileMoneyAgentFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToCbnAgentVerified(input: { cbnSubAgentNumber: string | null }): GuardResult {
  if (!input.cbnSubAgentNumber || input.cbnSubAgentNumber.trim() === '') {
    return { allowed: false, reason: 'CBN sub-agent number required to verify mobile money agent' };
  }
  return { allowed: true };
}

export function guardDailyCapKobo(input: { dailyUsedKobo: number; amountKobo: number; dailyLimitKobo: number }): GuardResult {
  if (input.dailyUsedKobo + input.amountKobo > input.dailyLimitKobo) {
    return { allowed: false, reason: `CBN daily cap exceeded: would reach ${input.dailyUsedKobo + input.amountKobo} kobo, limit is ${input.dailyLimitKobo} kobo` };
  }
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'Mobile money agent AI capped at L2 advisory — daily float utilisation aggregate only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'Mobile money agent AI capped at L2' };
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

export interface MobileMoneyAgentProfile {
  id: string; workspaceId: string; tenantId: string;
  agentName: string; cbnSubAgentNumber: string | null;
  superAgentProvider: string | null; superAgentLicenceNumber: string | null; cacOrTin: string | null;
  status: MobileMoneyAgentFSMState; createdAt: number; updatedAt: number;
}

export interface MmFloat {
  id: string; agentId: string; tenantId: string;
  floatBalanceKobo: number; dailyUsedKobo: number; dailyLimitKobo: number;
  lastTopupKobo: number; lastTopupDate: number;
  createdAt: number; updatedAt: number;
}

export interface MmTransaction {
  id: string; agentId: string; tenantId: string;
  transactionType: MmTransactionType; amountKobo: number; commissionKobo: number;
  customerBvnRef: string; referenceNumber: string; transactionDate: number;
  status: MmTransactionStatus; createdAt: number; updatedAt: number;
}

export interface CreateMobileMoneyAgentInput {
  id?: string; workspaceId: string; tenantId: string;
  agentName: string; cbnSubAgentNumber?: string;
  superAgentProvider?: string; superAgentLicenceNumber?: string; cacOrTin?: string;
}

export interface CreateMmTransactionInput {
  id?: string; agentId: string; tenantId: string;
  transactionType: MmTransactionType; amountKobo: number; commissionKobo: number;
  customerBvnRef: string; referenceNumber: string; transactionDate: number;
}
