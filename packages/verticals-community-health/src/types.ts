/**
 * @webwaka/verticals-community-health — types + FSM guards (M12)
 * FSM: seeded → claimed → nphcda_registered → active → suspended
 * P13: household_ref_id opaque UUID — no patient names or addresses
 * P12: USSD-safe routes mandatory; AI blocked on USSD sessions
 * T3: all queries scoped to tenant_id
 * KYC: Tier 1 (no monetary transactions at this level)
 */

export type CommunityHealthFSMState =
  | 'seeded'
  | 'claimed'
  | 'nphcda_registered'
  | 'active'
  | 'suspended';

export type TrainingLevel = 'CHW' | 'CHEW' | 'SCHEW';

const FSM_TRANSITIONS: Record<CommunityHealthFSMState, CommunityHealthFSMState[]> = {
  seeded:            ['claimed'],
  claimed:           ['nphcda_registered'],
  nphcda_registered: ['active'],
  active:            ['suspended'],
  suspended:         ['active'],
};

export function isValidCommunityHealthTransition(
  from: CommunityHealthFSMState,
  to: CommunityHealthFSMState,
): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToNphcdaRegistered(input: {
  nphcdaAffiliation: string | null | undefined;
  stateMohRegistration: string | null | undefined;
}): GuardResult {
  if (!input.nphcdaAffiliation) return { allowed: false, reason: 'NPHCDA affiliation required' };
  if (!input.stateMohRegistration) return { allowed: false, reason: 'State MOH registration required' };
  return { allowed: true };
}

export function guardUssdAiBlock(input: { isUssdSession: boolean }): GuardResult {
  if (input.isUssdSession) return { allowed: false, reason: 'P12: AI calls blocked on USSD sessions' };
  return { allowed: true };
}

export function guardP13HouseholdData(input: { payloadKeys: string[] }): GuardResult {
  const banned = ['household_name', 'patient_name', 'address', 'phone', 'diagnosis', 'condition'];
  const violations = input.payloadKeys.filter(k => banned.some(b => k.toLowerCase().includes(b)));
  if (violations.length > 0) return { allowed: false, reason: `P13 violation: household data in AI payload: ${violations.join(', ')}` };
  return { allowed: true };
}

export function guardIntegerCount(count: number, field: string): GuardResult {
  if (!Number.isInteger(count) || count < 0) return { allowed: false, reason: `${field} must be a non-negative integer` };
  return { allowed: true };
}

export interface CommunityHealthProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  orgName: string;
  nphcdaAffiliation: string | null;
  stateMohRegistration: string | null;
  lga: string | null;
  status: CommunityHealthFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface ChwWorker {
  id: string;
  profileId: string;
  tenantId: string;
  chwRefId: string;
  trainingLevel: TrainingLevel;
  lga: string | null;
  ward: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChwVisit {
  id: string;
  profileId: string;
  tenantId: string;
  chwRefId: string;
  householdRefId: string;
  visitDate: number;
  servicesProvided: string | null;
  referralFlag: boolean;
  createdAt: number;
}

export interface ChwImmunisation {
  id: string;
  profileId: string;
  tenantId: string;
  chwRefId: string;
  vaccineName: string;
  dosesAdministered: number;
  tallyDate: number;
  lga: string | null;
  ward: string | null;
  createdAt: number;
}

export interface ChwStock {
  id: string;
  profileId: string;
  tenantId: string;
  itemName: string;
  unitCount: number;
  dispensedCount: number;
  lastRestocked: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCommunityHealthInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  orgName: string;
  nphcdaAffiliation?: string;
  stateMohRegistration?: string;
  lga?: string;
}

export interface UpdateCommunityHealthInput {
  orgName?: string;
  nphcdaAffiliation?: string | null;
  stateMohRegistration?: string | null;
  lga?: string | null;
}

export interface CreateChwWorkerInput {
  id?: string;
  profileId: string;
  tenantId: string;
  chwRefId?: string;
  trainingLevel?: TrainingLevel;
  lga?: string;
  ward?: string;
}

export interface CreateChwVisitInput {
  id?: string;
  profileId: string;
  tenantId: string;
  chwRefId: string;
  householdRefId?: string;
  visitDate?: number;
  servicesProvided?: string;
  referralFlag?: boolean;
}

export interface CreateChwImmunisationInput {
  id?: string;
  profileId: string;
  tenantId: string;
  chwRefId: string;
  vaccineName: string;
  dosesAdministered: number;
  tallyDate?: number;
  lga?: string;
  ward?: string;
}

export interface CreateChwStockInput {
  id?: string;
  profileId: string;
  tenantId: string;
  itemName: string;
  unitCount?: number;
  dispensedCount?: number;
}
