/**
 * @webwaka/verticals-sports-academy — types + FSM guards (M10)
 * FSM: seeded → claimed → permit_verified → active → suspended
 * P13: member health data (weight, BMI) must never reach AI
 * P9: all kobo values must be integers
 * T3: all queries scoped to tenant_id
 * KYC: Tier 1 for cash membership; Tier 2 for annual subscriptions above ₦200k
 */

export type SportsAcademyFSMState =
  | 'seeded'
  | 'claimed'
  | 'permit_verified'
  | 'active'
  | 'suspended';

export type AcademyType =
  | 'gym'
  | 'football_academy'
  | 'tennis'
  | 'martial_arts'
  | 'other';

export type MembershipPlan = 'monthly' | 'quarterly' | 'annual';

export type MemberStatus = 'active' | 'lapsed' | 'suspended';

const FSM_TRANSITIONS: Record<SportsAcademyFSMState, SportsAcademyFSMState[]> = {
  seeded:          ['claimed'],
  claimed:         ['permit_verified'],
  permit_verified: ['active'],
  active:          ['suspended'],
  suspended:       ['active'],
};

export function isValidSportsAcademyTransition(
  from: SportsAcademyFSMState,
  to: SportsAcademyFSMState,
): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToPermitVerified(input: {
  stateSportsPermit: string | null | undefined;
}): GuardResult {
  if (!input.stateSportsPermit) return { allowed: false, reason: 'State sports council permit number required' };
  return { allowed: true };
}

export function guardHighValueMembership(input: {
  planFeeKobo: number;
  membershipPlan: string;
  kycTier: number;
}): GuardResult {
  const ANNUAL_KYC2_THRESHOLD_KOBO = 20_000_000;
  if (input.membershipPlan === 'annual' && input.planFeeKobo > ANNUAL_KYC2_THRESHOLD_KOBO && input.kycTier < 2) {
    return { allowed: false, reason: 'KYC Tier 2 required for annual subscriptions above ₦200k' };
  }
  return { allowed: true };
}

export function guardP13HealthMetrics(input: { payloadKeys: string[] }): GuardResult {
  const banned = ['weight', 'bmi', 'body_fat', 'blood_pressure', 'health_condition', 'medical_history'];
  const violations = input.payloadKeys.filter(k => banned.some(b => k.toLowerCase().includes(b)));
  if (violations.length > 0) return { allowed: false, reason: `P13 violation: member health data in AI payload: ${violations.join(', ')}` };
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface SportsAcademyProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  academyName: string;
  type: AcademyType;
  stateSportsPermit: string | null;
  cacRc: string | null;
  status: SportsAcademyFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface SportsMember {
  id: string;
  profileId: string;
  tenantId: string;
  memberRefId: string;
  membershipPlan: MembershipPlan;
  planFeeKobo: number;
  validUntil: number | null;
  status: MemberStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SportsClass {
  id: string;
  profileId: string;
  tenantId: string;
  className: string;
  trainerId: string | null;
  scheduleDay: string | null;
  scheduleTime: string | null;
  capacity: number;
  enrolledCount: number;
  classFeeKobo: number;
  createdAt: number;
  updatedAt: number;
}

export interface SportsCheckin {
  id: string;
  profileId: string;
  tenantId: string;
  memberRefId: string;
  classId: string | null;
  checkDate: number;
  createdAt: number;
}

export interface SportsEquipment {
  id: string;
  profileId: string;
  tenantId: string;
  equipmentName: string;
  quantity: number;
  purchaseCostKobo: number;
  lastServiceDate: number | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSportsAcademyInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  academyName: string;
  type?: AcademyType;
  stateSportsPermit?: string;
  cacRc?: string;
}

export interface UpdateSportsAcademyInput {
  academyName?: string;
  type?: AcademyType;
  stateSportsPermit?: string | null;
  cacRc?: string | null;
}

export interface CreateSportsMemberInput {
  id?: string;
  profileId: string;
  tenantId: string;
  memberRefId?: string;
  membershipPlan?: MembershipPlan;
  planFeeKobo: number;
  validUntil?: number;
}

export interface CreateSportsClassInput {
  id?: string;
  profileId: string;
  tenantId: string;
  className: string;
  trainerId?: string;
  scheduleDay?: string;
  scheduleTime?: string;
  capacity?: number;
  classFeeKobo?: number;
}

export interface CreateSportsCheckinInput {
  id?: string;
  profileId: string;
  tenantId: string;
  memberRefId: string;
  classId?: string;
  checkDate?: number;
}

export interface CreateSportsEquipmentInput {
  id?: string;
  profileId: string;
  tenantId: string;
  equipmentName: string;
  quantity?: number;
  purchaseCostKobo: number;
  lastServiceDate?: number;
}
