/**
 * @webwaka/verticals-clearing-agent — Domain types
 * M9 Transport Extended — Task V-TRN-EXT-1
 *
 * FSM: seeded → claimed → ncs_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:        KYC Tier 1
 *   claimed → ncs_verified:  NCS licence + NAGAFF number required; KYC Tier 3
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: bill_of_lading, container_number, client details never passed to AI layer
 */

export type ClearingAgentFSMState =
  | 'seeded'
  | 'claimed'
  | 'ncs_verified'
  | 'active'
  | 'suspended';

export type ShipmentStatus =
  | 'lodgement'
  | 'examination'
  | 'duty_assessment'
  | 'duty_paid'
  | 'released'
  | 'delivered';

export type ShipmentPort =
  | 'apapa'
  | 'tin_can'
  | 'onne'
  | 'calabar'
  | 'other';

export interface ClearingAgentProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  ncsLicence: string | null;
  nagaffNumber: string | null;
  cacRc: string | null;
  status: ClearingAgentFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateClearingAgentInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  ncsLicence?: string | undefined;
  nagaffNumber?: string | undefined;
  cacRc?: string | undefined;
}

export interface UpdateClearingAgentInput {
  companyName?: string | undefined;
  ncsLicence?: string | null | undefined;
  nagaffNumber?: string | null | undefined;
  cacRc?: string | null | undefined;
  status?: ClearingAgentFSMState | undefined;
}

export interface ClearingShipment {
  id: string;
  profileId: string;
  tenantId: string;
  clientPhone: string | null;
  vesselName: string | null;
  billOfLading: string | null;
  containerNumber: string | null;
  cargoDescription: string | null;
  declaredValueKobo: number;
  dutyAmountKobo: number;
  vatKobo: number;
  portChargesKobo: number;
  professionalFeeKobo: number;
  formMNumber: string | null;
  nafdacPermitRef: string | null;
  port: ShipmentPort;
  status: ShipmentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateShipmentInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  clientPhone?: string | undefined;
  vesselName?: string | undefined;
  billOfLading?: string | undefined;
  containerNumber?: string | undefined;
  cargoDescription?: string | undefined;
  declaredValueKobo: number;
  dutyAmountKobo: number;
  vatKobo?: number | undefined;
  portChargesKobo?: number | undefined;
  professionalFeeKobo: number;
  formMNumber?: string | undefined;
  nafdacPermitRef?: string | undefined;
  port?: ShipmentPort | undefined;
}

export const VALID_CLEARING_AGENT_TRANSITIONS: Record<ClearingAgentFSMState, ClearingAgentFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['ncs_verified', 'suspended'],
  ncs_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidClearingAgentTransition(from: ClearingAgentFSMState, to: ClearingAgentFSMState): boolean {
  return VALID_CLEARING_AGENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim clearing agent profile' };
  return { allowed: true };
}

export function guardClaimedToNcsVerified(ctx: { ncsLicence: string | null; nagaffNumber: string | null; kycTier: number }): { allowed: boolean; reason?: string } {
  if (!ctx.ncsLicence) return { allowed: false, reason: 'NCS licence required for ncs_verified transition' };
  if (!ctx.nagaffNumber) return { allowed: false, reason: 'NAGAFF number required for ncs_verified transition' };
  if (ctx.kycTier < 3) return { allowed: false, reason: 'KYC Tier 3 required for ncs_verified transition' };
  return { allowed: true };
}
