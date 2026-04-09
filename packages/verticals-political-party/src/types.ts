/**
 * packages/verticals-political-party — Domain types
 * (M8b scaffold — TDR-0011, Platform Invariants T3)
 *
 * FSM: seeded → claimed → active → suspended → deprecated
 *      (extends BASE_VERTICAL_FSM from packages/verticals)
 *
 * A political party is modeled as an Organization entity.
 * CAC verification required for activation.
 */

export type PartyFSMState =
  | 'seeded'
  | 'claimed'
  | 'active'
  | 'suspended'
  | 'deprecated';

export interface PoliticalPartyProfile {
  id: string;
  organizationId: string;
  workspaceId: string;
  tenantId: string;           // T3
  partyName: string;
  abbreviation: string | null;
  cacRegNumber: string | null;
  inecRegNumber: string | null;
  chairpersonId: string | null;   // individual_id
  status: PartyFSMState;
  createdAt: number;
}

export interface CreatePartyInput {
  id?: string;
  organizationId: string;
  workspaceId: string;
  tenantId: string;
  partyName: string;
  abbreviation?: string;
}

export interface UpdatePartyInput {
  partyName?: string;
  abbreviation?: string | null;
  cacRegNumber?: string | null;
  inecRegNumber?: string | null;
  chairpersonId?: string | null;
  status?: PartyFSMState;
}

export type PartyFSMGuardResult = { allowed: true } | { allowed: false; reason: string };

export function guardPartyClaimToActive(opts: {
  cacRegNumber: string | null;
}): PartyFSMGuardResult {
  if (!opts.cacRegNumber) {
    return { allowed: false, reason: 'CAC registration number required to activate political party' };
  }
  return { allowed: true };
}

export const VALID_PARTY_TRANSITIONS: Array<[PartyFSMState, PartyFSMState]> = [
  ['seeded',    'claimed'],
  ['claimed',   'active'],
  ['active',    'suspended'],
  ['suspended', 'active'],
  ['active',    'deprecated'],
];

export function isValidPartyTransition(from: PartyFSMState, to: PartyFSMState): boolean {
  return VALID_PARTY_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
