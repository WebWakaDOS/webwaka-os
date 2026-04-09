/**
 * @webwaka/verticals-dental-clinic — types + FSM guards (M9)
 * FSM: seeded → claimed → mdcn_verified → active → suspended
 * P13: patient_ref_id is opaque UUID — patient name/diagnosis/treatment content NEVER in D1
 * P9: all kobo values must be integers
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 for treatment billing; Tier 3 for dental insurance claims
 */

export type DentalClinicFSMState =
  | 'seeded'
  | 'claimed'
  | 'mdcn_verified'
  | 'active'
  | 'suspended';

export type TreatmentType =
  | 'consultation'
  | 'cleaning'
  | 'filling'
  | 'extraction'
  | 'orthodontics'
  | 'xray'
  | 'implant';

export type AppointmentStatus =
  | 'booked'
  | 'confirmed'
  | 'attended'
  | 'cancelled'
  | 'no_show';

const FSM_TRANSITIONS: Record<DentalClinicFSMState, DentalClinicFSMState[]> = {
  seeded:        ['claimed'],
  claimed:       ['mdcn_verified'],
  mdcn_verified: ['active'],
  active:        ['suspended'],
  suspended:     ['active'],
};

export function isValidDentalClinicTransition(
  from: DentalClinicFSMState,
  to: DentalClinicFSMState,
): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToMdcnVerified(input: {
  mdcnFacilityReg: string | null | undefined;
  kycTier: number;
}): GuardResult {
  if (!input.mdcnFacilityReg) return { allowed: false, reason: 'MDCN facility registration number required' };
  if (input.kycTier < 2) return { allowed: false, reason: 'KYC Tier 2 required for MDCN verification' };
  return { allowed: true };
}

export function guardKycForInsurance(input: { kycTier: number }): GuardResult {
  if (input.kycTier < 3) return { allowed: false, reason: 'KYC Tier 3 required for dental insurance claims' };
  return { allowed: true };
}

export function guardP13PatientData(input: { payloadKeys: string[] }): GuardResult {
  const banned = ['patient_name', 'patient_phone', 'patient_address', 'diagnosis', 'treatment_notes', 'clinical_notes'];
  const violations = input.payloadKeys.filter(k => banned.some(b => k.toLowerCase().includes(b)));
  if (violations.length > 0) return { allowed: false, reason: `P13 violation: clinical data in AI payload: ${violations.join(', ')}` };
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface DentalClinicProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  clinicName: string;
  mdcnFacilityReg: string | null;
  adsnMembership: string | null;
  cacRc: string | null;
  status: DentalClinicFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface DentalDentist {
  id: string;
  profileId: string;
  tenantId: string;
  dentistRefId: string;
  mdcnRegNumber: string;
  specialisation: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface DentalAppointment {
  id: string;
  profileId: string;
  tenantId: string;
  patientRefId: string;
  dentistRefId: string;
  appointmentTime: number;
  treatmentType: TreatmentType;
  consultationFeeKobo: number;
  status: AppointmentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface DentalTreatment {
  id: string;
  profileId: string;
  appointmentId: string;
  tenantId: string;
  treatmentCostKobo: number;
  labRef: string | null;
  notesRef: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateDentalClinicInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  clinicName: string;
  mdcnFacilityReg?: string;
  adsnMembership?: string;
  cacRc?: string;
}

export interface UpdateDentalClinicInput {
  clinicName?: string;
  mdcnFacilityReg?: string | null;
  adsnMembership?: string | null;
  cacRc?: string | null;
}

export interface CreateDentistInput {
  id?: string;
  profileId: string;
  tenantId: string;
  dentistRefId?: string;
  mdcnRegNumber: string;
  specialisation?: string;
}

export interface CreateAppointmentInput {
  id?: string;
  profileId: string;
  tenantId: string;
  patientRefId?: string;
  dentistRefId: string;
  appointmentTime: number;
  treatmentType?: TreatmentType;
  consultationFeeKobo: number;
}

export interface CreateTreatmentInput {
  id?: string;
  profileId: string;
  appointmentId: string;
  tenantId: string;
  treatmentCostKobo: number;
  labRef?: string;
  notesRef?: string;
}
