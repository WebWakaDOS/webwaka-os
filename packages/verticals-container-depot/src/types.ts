/**
 * @webwaka/verticals-container-depot — Domain types
 * M12 Transport Extended — Task V-TRN-EXT-6
 *
 * FSM: seeded → claimed → ncs_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:       KYC Tier 1
 *   claimed → ncs_verified: NCS + NPA licences required; KYC Tier 3
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: container_number, client details never passed to AI layer
 */

export type ContainerDepotFSMState =
  | 'seeded'
  | 'claimed'
  | 'ncs_verified'
  | 'active'
  | 'suspended';

export type ContainerType = '20ft' | '40ft';
export type OperationType = 'stuffing' | 'stripping' | 'storage';
export type ContainerStatus = 'received' | 'in_operation' | 'awaiting_release' | 'released';

export interface ContainerDepotProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  ncsLicence: string | null;
  npaLicence: string | null;
  cacRc: string | null;
  depotLocation: string | null;
  status: ContainerDepotFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateContainerDepotInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  ncsLicence?: string | undefined;
  npaLicence?: string | undefined;
  cacRc?: string | undefined;
  depotLocation?: string | undefined;
}

export interface UpdateContainerDepotInput {
  companyName?: string | undefined;
  ncsLicence?: string | null | undefined;
  npaLicence?: string | null | undefined;
  cacRc?: string | null | undefined;
  depotLocation?: string | null | undefined;
  status?: ContainerDepotFSMState | undefined;
}

export interface ContainerRecord {
  id: string;
  profileId: string;
  tenantId: string;
  containerNumber: string;
  containerType: ContainerType;
  weightKg: number;
  clientPhone: string | null;
  operationType: OperationType;
  dailyStorageRateKobo: number;
  daysInDepot: number;
  storageChargeKobo: number;
  ncsReleaseNumber: string | null;
  status: ContainerStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateContainerRecordInput {
  id?: string | undefined;
  profileId: string;
  tenantId: string;
  containerNumber: string;
  containerType?: ContainerType | undefined;
  weightKg: number;
  clientPhone?: string | undefined;
  operationType?: OperationType | undefined;
  dailyStorageRateKobo: number;
  daysInDepot?: number | undefined;
  ncsReleaseNumber?: string | undefined;
}

export const VALID_CONTAINER_DEPOT_TRANSITIONS: Record<ContainerDepotFSMState, ContainerDepotFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['ncs_verified', 'suspended'],
  ncs_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidContainerDepotTransition(from: ContainerDepotFSMState, to: ContainerDepotFSMState): boolean {
  return VALID_CONTAINER_DEPOT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim container depot profile' };
  return { allowed: true };
}

export function guardClaimedToNcsVerified(ctx: { ncsLicence: string | null; npaLicence: string | null; kycTier: number }): { allowed: boolean; reason?: string } {
  if (!ctx.ncsLicence) return { allowed: false, reason: 'NCS licence required for ncs_verified transition' };
  if (!ctx.npaLicence) return { allowed: false, reason: 'NPA licence required for ncs_verified transition' };
  if (ctx.kycTier < 3) return { allowed: false, reason: 'KYC Tier 3 required for ncs_verified transition' };
  return { allowed: true };
}
