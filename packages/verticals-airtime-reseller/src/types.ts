/**
 * @webwaka/verticals-airtime-reseller — types + FSM guards (M12)
 * FSM: seeded → claimed → ncc_verified → active → suspended
 * AI: L2 cap — daily revenue trend (aggregate only); no recipient_phone to AI (P13)
 * P9: all monetary values in kobo integers; commission_kobo from commission_bps
 * CBN sub-agent daily cap: 30,000,000 kobo (₦300,000) enforced at route level
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 standard; Tier 3 for CBN sub-agent
 */

export type AirtimeResellerFSMState =
  | 'seeded'
  | 'claimed'
  | 'ncc_verified'
  | 'active'
  | 'suspended';

export type AirtimeNetwork = 'MTN' | 'Airtel' | 'Glo' | '9mobile';
export type AirtimeTransactionStatus = 'pending' | 'completed' | 'failed';

const FSM_TRANSITIONS: Record<AirtimeResellerFSMState, AirtimeResellerFSMState[]> = {
  seeded:       ['claimed'],
  claimed:      ['ncc_verified'],
  ncc_verified: ['active'],
  active:       ['suspended'],
  suspended:    ['active'],
};

export function isValidAirtimeResellerTransition(from: AirtimeResellerFSMState, to: AirtimeResellerFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToNccVerified(input: { nccDealerCode: string | null }): GuardResult {
  if (!input.nccDealerCode || input.nccDealerCode.trim() === '') {
    return { allowed: false, reason: 'NCC dealer code required to verify airtime reseller' };
  }
  return { allowed: true };
}

export function guardCbnDailyCapKobo(input: { dailyUsedKobo: number; amountKobo: number; dailyLimitKobo?: number }): GuardResult {
  const limit = input.dailyLimitKobo ?? 30_000_000;
  if (input.dailyUsedKobo + input.amountKobo > limit) {
    return { allowed: false, reason: `CBN sub-agent daily cap exceeded: ${input.dailyUsedKobo + input.amountKobo} > ${limit} kobo` };
  }
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'Airtime reseller AI capped at L2 advisory — daily revenue trend aggregate only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'Airtime reseller AI capped at L2' };
  }
  return { allowed: true };
}

export function guardNoRecipientInAi(payload: Record<string, unknown>): GuardResult {
  const forbidden = ['recipient_phone', 'recipientPhone'];
  for (const key of forbidden) {
    if (key in payload) return { allowed: false, reason: `P13: recipient_phone must not pass to AI` };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface AirtimeResellerProfile {
  id: string; workspaceId: string; tenantId: string;
  businessName: string; nccDealerCode: string | null;
  cbnSubAgentNumber: string | null;
  status: AirtimeResellerFSMState; createdAt: number; updatedAt: number;
}

export interface AirtimeWallet {
  id: string; resellerId: string; tenantId: string;
  walletBalanceKobo: number; dailyUsedKobo: number; dailyResetDate: number;
  createdAt: number; updatedAt: number;
}

export interface AirtimeTransaction {
  id: string; resellerId: string; tenantId: string;
  recipientPhone: string; network: AirtimeNetwork;
  amountKobo: number; commissionKobo: number;
  transactionDate: number; status: AirtimeTransactionStatus;
  createdAt: number; updatedAt: number;
}

export interface CreateAirtimeResellerInput {
  id?: string; workspaceId: string; tenantId: string;
  businessName: string; nccDealerCode?: string; cbnSubAgentNumber?: string;
}

export interface CreateAirtimeTransactionInput {
  id?: string; resellerId: string; tenantId: string;
  recipientPhone: string; network: AirtimeNetwork;
  amountKobo: number; commissionKobo: number; transactionDate: number;
}
