/**
 * packages/verticals-politician — Domain types
 * (M8b — TDR-0011, Platform Invariants T3, P9)
 *
 * FSM:  seeded → claimed → candidate → elected → in_office → post_office
 *       in_office is surfaced publicly as `active`
 *
 * KYC gates:
 *   seeded  → claimed    requires KYC Tier 2 + NIN verified
 *   claimed → candidate  requires KYC Tier 2 + INEC filing reference
 *   candidate → elected  admin only (election results)
 *   elected → in_office  admin only (sworn-in)
 *   in_office → post_office  admin only (term end)
 */

export type PoliticianFSMState =
  | 'seeded'
  | 'claimed'
  | 'candidate'
  | 'elected'
  | 'in_office'
  | 'post_office'
  | 'active';      // public alias for in_office

export type OfficeType =
  | 'councilor'
  | 'lga_chairman'
  | 'state_assembly'
  | 'hor'
  | 'senator'
  | 'governor'
  | 'president';

export interface PoliticianProfile {
  id: string;
  individualId: string;
  workspaceId: string;
  tenantId: string;             // T3 — always present
  officeType: OfficeType;
  jurisdictionId: string;
  partyId: string | null;       // null = independent
  ninVerified: boolean;
  inecFilingRef: string | null;
  termStart: number | null;     // Unix timestamp
  termEnd: number | null;       // Unix timestamp; null = ongoing
  status: PoliticianFSMState;
  createdAt: number;            // Unix timestamp
}

export interface CreatePoliticianInput {
  id?: string;
  individualId: string;
  workspaceId: string;
  tenantId: string;
  officeType: OfficeType;
  jurisdictionId: string;
  partyId?: string;
}

export interface UpdatePoliticianInput {
  officeType?: OfficeType;
  jurisdictionId?: string;
  partyId?: string | null;
  ninVerified?: boolean;
  inecFilingRef?: string | null;
  termStart?: number | null;
  termEnd?: number | null;
  status?: PoliticianFSMState;
}

// ---------------------------------------------------------------------------
// Campaign — donation + volunteer management
// ---------------------------------------------------------------------------

export type CampaignStatus = 'draft' | 'active' | 'closed';

export interface CampaignDonation {
  id: string;
  workspaceId: string;
  tenantId: string;           // T3
  donorPhone: string;         // P13 — never sent to AI
  amountKobo: number;         // P9 — integer only
  paystackRef: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: number;
}

export interface CreateDonationInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  donorPhone: string;
  amountKobo: number;
  paystackRef?: string;
}

// ---------------------------------------------------------------------------
// FSM transition guards (pure logic — no I/O)
// ---------------------------------------------------------------------------

export type FSMGuardResult = { allowed: true } | { allowed: false; reason: string };

export function guardSeedToClaimed(opts: {
  kycTier: number;
  ninVerified: boolean;
}): FSMGuardResult {
  if (opts.kycTier < 2) {
    return { allowed: false, reason: 'KYC Tier 2 required to claim politician profile' };
  }
  if (!opts.ninVerified) {
    return { allowed: false, reason: 'NIN must be verified before claiming politician profile' };
  }
  return { allowed: true };
}

export function guardClaimedToCandidate(opts: {
  kycTier: number;
  inecFilingRef: string | null;
}): FSMGuardResult {
  if (opts.kycTier < 2) {
    return { allowed: false, reason: 'KYC Tier 2 required to file as candidate' };
  }
  if (!opts.inecFilingRef) {
    return { allowed: false, reason: 'INEC filing reference required' };
  }
  return { allowed: true };
}

export const VALID_POLITICIAN_TRANSITIONS: Array<[PoliticianFSMState, PoliticianFSMState]> = [
  ['seeded',    'claimed'],
  ['claimed',   'candidate'],
  ['candidate', 'elected'],
  ['elected',   'in_office'],
  ['in_office', 'post_office'],
  ['in_office', 'active'],     // public synonym — does not change DB state
];

export function isValidPoliticianTransition(
  from: PoliticianFSMState,
  to: PoliticianFSMState,
): boolean {
  return VALID_POLITICIAN_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
