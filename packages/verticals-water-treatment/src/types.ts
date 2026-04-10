/**
 * @webwaka/verticals-water-treatment — types + FSM guards (M11)
 * FSM: seeded → claimed → nafdac_verified → active → suspended
 * AI: L2 cap — water quality alert (aggregate stats only); no client details to AI (P13)
 * P9: all monetary values in kobo integers; volume in integer litres; capacity in integer litres/day
 * SCALED INTEGERS: ph_x100 (pH × 100), chlorine_ppm10 (ppm × 10), turbidity_ntu10 (NTU × 10) — NO floats
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 standard; Tier 3 for estate utility contracts above ₦5M/month
 */

export type WaterTreatmentFSMState =
  | 'seeded'
  | 'claimed'
  | 'nafdac_verified'
  | 'active'
  | 'suspended';

export type PropertyType = 'residential' | 'commercial' | 'estate';
export type PaymentStatus = 'active' | 'suspended' | 'cancelled';

const FSM_TRANSITIONS: Record<WaterTreatmentFSMState, WaterTreatmentFSMState[]> = {
  seeded:          ['claimed'],
  claimed:         ['nafdac_verified'],
  nafdac_verified: ['active'],
  active:          ['suspended'],
  suspended:       ['active'],
};

export function isValidWaterTreatmentTransition(from: WaterTreatmentFSMState, to: WaterTreatmentFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToNafdacVerified(input: { nafdacWaterLicence: string | null }): GuardResult {
  if (!input.nafdacWaterLicence || input.nafdacWaterLicence.trim() === '') {
    return { allowed: false, reason: 'NAFDAC water licence required to verify water treatment operator' };
  }
  return { allowed: true };
}

export function guardScaledIntegerPh(phX100: number): GuardResult {
  if (!Number.isInteger(phX100) || phX100 < 0 || phX100 > 1400) {
    return { allowed: false, reason: 'pH must be stored as integer × 100 (e.g., 720 = pH 7.20) — no floats' };
  }
  return { allowed: true };
}

export function guardScaledIntegerChlorine(ppm10: number): GuardResult {
  if (!Number.isInteger(ppm10) || ppm10 < 0) {
    return { allowed: false, reason: 'Chlorine must be stored as integer ppm × 10 — no floats' };
  }
  return { allowed: true };
}

export function guardL2AiCap(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'Water treatment AI capped at L2 advisory — quality aggregate stats only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'Water treatment AI capped at L2' };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface WaterTreatmentProfile {
  id: string; workspaceId: string; tenantId: string;
  companyName: string; nafdacWaterLicence: string | null;
  stateWaterBoardCert: string | null; cacRc: string | null; capacityLitresPerDay: number;
  status: WaterTreatmentFSMState; createdAt: number; updatedAt: number;
}

export interface WaterQualityLog {
  id: string; profileId: string; tenantId: string;
  testDate: number;
  phX100: number;          // pH × 100 (integer — no float)
  chlorinePpm10: number;   // ppm × 10 (integer — no float)
  turbidityNtu10: number;  // NTU × 10 (integer — no float)
  passedStandards: boolean; createdAt: number; updatedAt: number;
}

export interface WaterSubscription {
  id: string; profileId: string; tenantId: string;
  clientPhone: string; propertyType: PropertyType;
  monthlyRateKobo: number; dailyLitresAllocation: number;
  paymentStatus: PaymentStatus; createdAt: number; updatedAt: number;
}

export interface WaterBilling {
  id: string; subscriptionId: string; tenantId: string;
  clientPhone: string; billingMonth: string;
  volumeSuppliedLitres: number; billedKobo: number; paidKobo: number;
  createdAt: number; updatedAt: number;
}

export interface CreateWaterTreatmentInput {
  id?: string; workspaceId: string; tenantId: string;
  companyName: string; nafdacWaterLicence?: string;
  stateWaterBoardCert?: string; cacRc?: string; capacityLitresPerDay: number;
}

export interface CreateWaterQualityLogInput {
  id?: string; profileId: string; tenantId: string;
  testDate: number; phX100: number; chlorinePpm10: number; turbidityNtu10: number;
}

export interface CreateWaterSubscriptionInput {
  id?: string; profileId: string; tenantId: string;
  clientPhone: string; propertyType: PropertyType;
  monthlyRateKobo: number; dailyLitresAllocation: number;
}
