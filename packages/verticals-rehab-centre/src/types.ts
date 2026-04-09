/**
 * @webwaka/verticals-rehab-centre — types + FSM guards (M12)
 * FSM: seeded → claimed → ndlea_verified → active → suspended
 * P13 CRITICAL: resident_ref_id opaque UUID — NEVER name, condition, substance, diagnosis in D1
 * L3 HITL MANDATORY for ALL SuperAgent calls — no exceptions
 * P9: all kobo values must be integers
 * P12: USSD excluded
 * T3: all queries scoped to tenant_id
 * KYC: Tier 3 mandatory — rehabilitation involves extremely sensitive data
 */

export type RehabCentreFSMState =
  | 'seeded'
  | 'claimed'
  | 'ndlea_verified'
  | 'active'
  | 'suspended';

export type ProgrammeType = 'residential' | 'outpatient';

export type EnrolmentStatus =
  | 'active'
  | 'completed'
  | 'discharged_early'
  | 'transferred';

export type SessionType = 'group' | 'individual' | 'family';

const FSM_TRANSITIONS: Record<RehabCentreFSMState, RehabCentreFSMState[]> = {
  seeded:         ['claimed'],
  claimed:        ['ndlea_verified'],
  ndlea_verified: ['active'],
  active:         ['suspended'],
  suspended:      ['active'],
};

export function isValidRehabCentreTransition(
  from: RehabCentreFSMState,
  to: RehabCentreFSMState,
): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToNdleaVerified(input: {
  ndleaLicence: string | null | undefined;
  kycTier: number;
}): GuardResult {
  if (!input.ndleaLicence) return { allowed: false, reason: 'NDLEA licence required' };
  if (input.kycTier < 3) return { allowed: false, reason: 'KYC Tier 3 mandatory for rehabilitation centres' };
  return { allowed: true };
}

export function guardAiHitl(input: { autonomyLevel: string }): GuardResult {
  if (input.autonomyLevel !== 'L3_HITL') {
    return { allowed: false, reason: 'L3 HITL mandatory for ALL AI calls from rehab-centre vertical' };
  }
  return { allowed: true };
}

export function guardKycTier3(input: { kycTier: number }): GuardResult {
  if (input.kycTier < 3) return { allowed: false, reason: 'KYC Tier 3 required for rehabilitation facility operations' };
  return { allowed: true };
}

export function guardP13ResidentData(input: { payloadKeys: string[] }): GuardResult {
  const banned = [
    'resident_name', 'name', 'substance', 'condition', 'diagnosis',
    'addiction', 'drug', 'alcohol', 'mental_health', 'clinical',
  ];
  const violations = input.payloadKeys.filter(k =>
    banned.some(b => k.toLowerCase().includes(b))
  );
  if (violations.length > 0) {
    return { allowed: false, reason: `P13 CRITICAL: sensitive rehab data in AI payload: ${violations.join(', ')}` };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export function guardPositiveInteger(value: number, field: string): GuardResult {
  if (!Number.isInteger(value) || value <= 0) return { allowed: false, reason: `${field} must be a positive integer` };
  return { allowed: true };
}

export interface RehabCentreProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  centreName: string;
  ndleaLicence: string | null;
  fmhswRegistration: string | null;
  cacRc: string | null;
  bedCount: number;
  status: RehabCentreFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface RehabProgramme {
  id: string;
  profileId: string;
  tenantId: string;
  programmeName: string;
  durationDays: number;
  totalFeeKobo: number;
  programmeType: ProgrammeType;
  createdAt: number;
  updatedAt: number;
}

export interface RehabEnrolment {
  id: string;
  profileId: string;
  tenantId: string;
  residentRefId: string;
  programmeId: string;
  enrolmentDate: number;
  depositKobo: number;
  balanceKobo: number;
  status: EnrolmentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface RehabSession {
  id: string;
  profileId: string;
  tenantId: string;
  residentRefId: string;
  sessionDate: number;
  facilitatorId: string;
  sessionType: SessionType;
  createdAt: number;
}

export interface CreateRehabCentreInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  centreName: string;
  ndleaLicence?: string;
  fmhswRegistration?: string;
  cacRc?: string;
  bedCount?: number;
}

export interface UpdateRehabCentreInput {
  centreName?: string;
  ndleaLicence?: string | null;
  fmhswRegistration?: string | null;
  cacRc?: string | null;
  bedCount?: number;
}

export interface CreateRehabProgrammeInput {
  id?: string;
  profileId: string;
  tenantId: string;
  programmeName: string;
  durationDays: number;
  totalFeeKobo: number;
  programmeType?: ProgrammeType;
}

export interface CreateRehabEnrolmentInput {
  id?: string;
  profileId: string;
  tenantId: string;
  residentRefId?: string;
  programmeId: string;
  enrolmentDate?: number;
  depositKobo: number;
  balanceKobo: number;
}

export interface CreateRehabSessionInput {
  id?: string;
  profileId: string;
  tenantId: string;
  residentRefId: string;
  sessionDate?: number;
  facilitatorId: string;
  sessionType?: SessionType;
}
