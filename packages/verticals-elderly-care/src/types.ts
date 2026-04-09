/**
 * @webwaka/verticals-elderly-care — types + FSM guards (M12)
 * FSM: seeded → claimed → fmhsw_verified → active → suspended
 * P13: resident_ref_id opaque UUID — clinical care plan stored as encrypted reference
 * P9: all kobo values must be integers
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 for monthly billing; Tier 3 for diaspora transfers above ₦5M/year
 */

export type ElderlyCareProfileFSMState =
  | 'seeded'
  | 'claimed'
  | 'fmhsw_verified'
  | 'active'
  | 'suspended';

export type PayerType = 'resident' | 'family' | 'diaspora' | 'insurance';

export type ResidentStatus = 'active' | 'discharged' | 'deceased';

const FSM_TRANSITIONS: Record<ElderlyCareProfileFSMState, ElderlyCareProfileFSMState[]> = {
  seeded:         ['claimed'],
  claimed:        ['fmhsw_verified'],
  fmhsw_verified: ['active'],
  active:         ['suspended'],
  suspended:      ['active'],
};

export function isValidElderlyCareTransition(
  from: ElderlyCareProfileFSMState,
  to: ElderlyCareProfileFSMState,
): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToFmhswVerified(input: {
  fmhswRegistration: string | null | undefined;
  kycTier: number;
}): GuardResult {
  if (!input.fmhswRegistration) return { allowed: false, reason: 'FMHSW registration required' };
  if (input.kycTier < 2) return { allowed: false, reason: 'KYC Tier 2 required for FMHSW verification' };
  return { allowed: true };
}

export function guardDiasporaBilling(input: {
  annualTotalKobo: number;
  payerType: PayerType;
  kycTier: number;
}): GuardResult {
  const DIASPORA_KYC3_THRESHOLD_KOBO = 500_000_000;
  if (input.payerType === 'diaspora' && input.annualTotalKobo > DIASPORA_KYC3_THRESHOLD_KOBO && input.kycTier < 3) {
    return { allowed: false, reason: 'KYC Tier 3 required for diaspora-funded care above ₦5M/year' };
  }
  return { allowed: true };
}

export function guardP13ClinicalData(input: { payloadKeys: string[] }): GuardResult {
  const banned = ['resident_name', 'diagnosis', 'medication', 'care_plan_content', 'clinical_assessment', 'condition'];
  const violations = input.payloadKeys.filter(k => banned.some(b => k.toLowerCase().includes(b)));
  if (violations.length > 0) return { allowed: false, reason: `P13 violation: clinical data in AI payload: ${violations.join(', ')}` };
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface ElderlyCareProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  facilityName: string;
  fmhswRegistration: string | null;
  stateSocialWelfareCert: string | null;
  cacRc: string | null;
  bedCount: number;
  status: ElderlyCareProfileFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CareResident {
  id: string;
  profileId: string;
  tenantId: string;
  residentRefId: string;
  roomNumber: string | null;
  admissionDate: number;
  monthlyRateKobo: number;
  payerRefId: string | null;
  payerType: PayerType;
  status: ResidentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CareBilling {
  id: string;
  profileId: string;
  tenantId: string;
  residentRefId: string;
  billingPeriod: string;
  monthlyChargeKobo: number;
  paidKobo: number;
  outstandingKobo: number;
  paymentDate: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CareStaffRota {
  id: string;
  profileId: string;
  tenantId: string;
  staffName: string;
  role: string;
  shiftStart: number;
  shiftEnd: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateElderlyCareInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  facilityName: string;
  fmhswRegistration?: string;
  stateSocialWelfareCert?: string;
  cacRc?: string;
  bedCount?: number;
}

export interface UpdateElderlyCareInput {
  facilityName?: string;
  fmhswRegistration?: string | null;
  stateSocialWelfareCert?: string | null;
  cacRc?: string | null;
  bedCount?: number;
}

export interface CreateCareResidentInput {
  id?: string;
  profileId: string;
  tenantId: string;
  residentRefId?: string;
  roomNumber?: string;
  admissionDate?: number;
  monthlyRateKobo: number;
  payerRefId?: string;
  payerType?: PayerType;
}

export interface CreateCareBillingInput {
  id?: string;
  profileId: string;
  tenantId: string;
  residentRefId: string;
  billingPeriod: string;
  monthlyChargeKobo: number;
  paidKobo?: number;
  paymentDate?: number;
}

export interface CreateCareStaffRotaInput {
  id?: string;
  profileId: string;
  tenantId: string;
  staffName: string;
  role: string;
  shiftStart: number;
  shiftEnd: number;
}
