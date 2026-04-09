/**
 * @webwaka/verticals-vet-clinic — types + FSM guards (M10)
 * FSM: seeded → claimed → vcnb_verified → active → suspended
 * P13: animal_ref_id and owner_ref_id are opaque UUIDs — no diagnosis to AI
 * P9: all kobo values must be integers
 * T3: all queries scoped to tenant_id
 * KYC: Tier 1 for consultations; Tier 2 for surgery above ₦100k
 */

export type VetClinicFSMState =
  | 'seeded'
  | 'claimed'
  | 'vcnb_verified'
  | 'active'
  | 'suspended';

export type ClinicType = 'companion' | 'livestock' | 'both';

export type AppointmentType = 'consultation' | 'vaccination' | 'surgery' | 'grooming';

export type AppointmentStatus = 'booked' | 'attended' | 'cancelled';

export type ShopCategory = 'food' | 'accessory' | 'medication';

const FSM_TRANSITIONS: Record<VetClinicFSMState, VetClinicFSMState[]> = {
  seeded:        ['claimed'],
  claimed:       ['vcnb_verified'],
  vcnb_verified: ['active'],
  active:        ['suspended'],
  suspended:     ['active'],
};

export function isValidVetClinicTransition(
  from: VetClinicFSMState,
  to: VetClinicFSMState,
): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToVcnbVerified(input: {
  vcnbRegistration: string | null | undefined;
}): GuardResult {
  if (!input.vcnbRegistration) return { allowed: false, reason: 'VCNB registration number required' };
  return { allowed: true };
}

export function guardHighValueSurgery(input: {
  consultationFeeKobo: number;
  kycTier: number;
}): GuardResult {
  const SURGERY_KYC2_THRESHOLD_KOBO = 10_000_000;
  if (input.consultationFeeKobo > SURGERY_KYC2_THRESHOLD_KOBO && input.kycTier < 2) {
    return { allowed: false, reason: 'KYC Tier 2 required for procedures above ₦100,000' };
  }
  return { allowed: true };
}

export function guardP13AnimalClinicalData(input: { payloadKeys: string[] }): GuardResult {
  const banned = ['diagnosis', 'clinical_notes', 'prescription', 'animal_name', 'owner_name', 'owner_phone'];
  const violations = input.payloadKeys.filter(k => banned.some(b => k.toLowerCase().includes(b)));
  if (violations.length > 0) return { allowed: false, reason: `P13 violation: clinical/owner data in AI payload: ${violations.join(', ')}` };
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface VetClinicProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  clinicName: string;
  vcnbRegistration: string | null;
  cacRc: string | null;
  clinicType: ClinicType;
  status: VetClinicFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface VetPatient {
  id: string;
  profileId: string;
  tenantId: string;
  animalRefId: string;
  species: string;
  breed: string | null;
  ownerRefId: string;
  ageMonths: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface VetAppointment {
  id: string;
  profileId: string;
  tenantId: string;
  animalRefId: string;
  vetId: string;
  appointmentTime: number;
  appointmentType: AppointmentType;
  consultationFeeKobo: number;
  status: AppointmentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface VetVaccination {
  id: string;
  profileId: string;
  tenantId: string;
  animalRefId: string;
  vaccineName: string;
  dateAdministered: number;
  nextDue: number | null;
  costKobo: number;
  createdAt: number;
}

export interface VetShopInventoryItem {
  id: string;
  profileId: string;
  tenantId: string;
  productName: string;
  category: ShopCategory;
  unitPriceKobo: number;
  quantityInStock: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateVetClinicInput {
  id?: string;
  workspaceId: string;
  tenantId: string;
  clinicName: string;
  vcnbRegistration?: string;
  cacRc?: string;
  clinicType?: ClinicType;
}

export interface UpdateVetClinicInput {
  clinicName?: string;
  vcnbRegistration?: string | null;
  cacRc?: string | null;
  clinicType?: ClinicType;
}

export interface CreateVetPatientInput {
  id?: string;
  profileId: string;
  tenantId: string;
  animalRefId?: string;
  species: string;
  breed?: string;
  ownerRefId?: string;
  ageMonths?: number;
}

export interface CreateVetAppointmentInput {
  id?: string;
  profileId: string;
  tenantId: string;
  animalRefId: string;
  vetId: string;
  appointmentTime: number;
  appointmentType?: AppointmentType;
  consultationFeeKobo: number;
}

export interface CreateVetVaccinationInput {
  id?: string;
  profileId: string;
  tenantId: string;
  animalRefId: string;
  vaccineName: string;
  dateAdministered?: number;
  nextDue?: number;
  costKobo: number;
}

export interface CreateVetShopItemInput {
  id?: string;
  profileId: string;
  tenantId: string;
  productName: string;
  category?: ShopCategory;
  unitPriceKobo: number;
  quantityInStock?: number;
}
