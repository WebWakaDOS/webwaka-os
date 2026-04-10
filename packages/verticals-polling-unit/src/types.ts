/**
 * @webwaka/verticals-polling-unit — types + FSM guards (M12)
 * FSM: seeded → claimed → inec_accredited → active → suspended
 * AI: L3 HITL MANDATORY for ALL AI calls — electoral data is most politically sensitive
 * ABSOLUTE RULE: NO voter PII (names, BVN, individual records) stored or processed — ONLY aggregate counts
 * registered_voters, accredited_count, votes_cast: all INTEGER (no floats)
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 for data entry; Tier 3 for INEC-contracted digital services
 */

export type PollingUnitFSMState =
  | 'seeded'
  | 'claimed'
  | 'inec_accredited'
  | 'active'
  | 'suspended';

const FSM_TRANSITIONS: Record<PollingUnitFSMState, PollingUnitFSMState[]> = {
  seeded:           ['claimed'],
  claimed:          ['inec_accredited'],
  inec_accredited:  ['active'],
  active:           ['suspended'],
  suspended:        ['active'],
};

export function isValidPollingUnitTransition(from: PollingUnitFSMState, to: PollingUnitFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToInecAccredited(input: { inecAccreditation: string | null }): GuardResult {
  if (!input.inecAccreditation || input.inecAccreditation.trim() === '') {
    return { allowed: false, reason: 'INEC accreditation reference required' };
  }
  return { allowed: true };
}

export function guardL3HitlRequired(input: { hitlApproved: boolean | undefined }): GuardResult {
  if (!input.hitlApproved) {
    return { allowed: false, reason: 'L3 HITL approval MANDATORY for all electoral AI output — no exceptions' };
  }
  return { allowed: true };
}

export function guardNoVoterPiiInAi(payload: Record<string, unknown>): GuardResult {
  const forbidden = [
    'voter_id', 'voterId', 'bvn', 'voter_name', 'voterName',
    'candidate_breakdown', 'candidateBreakdown', 'party_votes', 'partyVotes',
    'individual_result', 'individualResult',
  ];
  for (const key of forbidden) {
    if (key in payload) return { allowed: false, reason: `P13/ELECTORAL: voter PII or individual result "${key}" must not pass to AI` };
  }
  return { allowed: true };
}

export function guardIntegerVoteCount(n: number): GuardResult {
  if (!Number.isInteger(n) || n < 0) return { allowed: false, reason: 'Vote and accreditation counts must be non-negative integers (no floats)' };
  return { allowed: true };
}

export interface PollingUnitProfile {
  id: string; workspaceId: string; tenantId: string;
  orgName: string; inecAccreditation: string | null;
  state: string; lga: string;
  status: PollingUnitFSMState; createdAt: number; updatedAt: number;
}

export interface PollingUnit {
  id: string; profileId: string; tenantId: string;
  unitCode: string; wardName: string; lga: string; state: string;
  registeredVoters: number; // aggregate count ONLY — no voter PII
  createdAt: number; updatedAt: number;
}

export interface ElectionEvent {
  id: string; unitId: string; profileId: string; tenantId: string;
  electionName: string; electionDate: number;
  accreditedCount: number; // aggregate count ONLY
  votesCast: number;       // aggregate count ONLY — no individual result
  formRef: string;         // INEC EC8A form reference (no raw results stored)
  createdAt: number; updatedAt: number;
}

export interface CreatePollingUnitProfileInput {
  id?: string; workspaceId: string; tenantId: string;
  orgName: string; inecAccreditation?: string; state: string; lga: string;
}

export interface CreatePollingUnitInput {
  id?: string; profileId: string; tenantId: string;
  unitCode: string; wardName: string; lga: string; state: string; registeredVoters: number;
}

export interface CreateElectionEventInput {
  id?: string; unitId: string; profileId: string; tenantId: string;
  electionName: string; electionDate: number;
  accreditedCount: number; votesCast: number; formRef: string;
}
