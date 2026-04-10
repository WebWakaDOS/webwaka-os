/**
 * @webwaka/verticals-cleaning-service — Domain types
 * M9 Commerce P2 — Task V-COMM-EXT-A6
 *
 * FSM: seeded → claimed → cac_verified → active → suspended
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 */

export type CleaningServiceFSMState =
  | 'seeded'
  | 'claimed'
  | 'cac_verified'
  | 'active'
  | 'suspended';

export type JobType = 'one_off' | 'recurring';

export type JobFrequency = 'weekly' | 'biweekly' | 'monthly';

export type CleaningJobStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'invoiced';

export interface CleaningServiceProfile {
  id: string;
  workspaceId: string;
  tenantId: string;         // T3
  companyName: string;
  cacNumber: string | null;
  envAgencyPermit: string | null;
  serviceTypes: string;     // JSON array
  status: CleaningServiceFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCleaningServiceInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  cacNumber?: string | undefined;
  envAgencyPermit?: string | undefined;
  serviceTypes?: string | undefined;
}

export interface UpdateCleaningServiceInput {
  companyName?: string | undefined;
  cacNumber?: string | null | undefined;
  envAgencyPermit?: string | null | undefined;
  serviceTypes?: string | undefined;
  status?: CleaningServiceFSMState | undefined;
}

export interface CleaningJob {
  id: string;
  workspaceId: string;
  tenantId: string;          // T3
  clientPhone: string;       // P13 — never sent to AI
  address: string;           // P13 — never sent to AI
  jobType: JobType;
  frequency: JobFrequency | null;
  priceKobo: number;         // P9
  assignedStaffId: string | null;
  status: CleaningJobStatus;
  scheduledAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCleaningJobInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  address: string;
  jobType: JobType;
  priceKobo: number;
  frequency?: JobFrequency | undefined;
  assignedStaffId?: string | undefined;
  scheduledAt?: number | undefined;
}

export interface CleaningSupply {
  id: string;
  workspaceId: string;
  tenantId: string;       // T3
  supplyName: string;
  unit: string;
  quantityInStockX1000: number; // P9 — stored ×1000, divide by 1000 for display
  unitCostKobo: number;   // P9
  createdAt: number;
}

export interface CreateCleaningSupplyInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  supplyName: string;
  unit: string;
  quantityInStockX1000: number; // P9 — stored ×1000, divide by 1000 for display
  unitCostKobo: number;
}

// ---------------------------------------------------------------------------
// FSM guard functions (pure — no I/O)
// ---------------------------------------------------------------------------

export type FSMGuardResult = { allowed: true } | { allowed: false; reason: string };

export function guardSeedToClaimed(opts: { kycTier: number }): FSMGuardResult {
  if (opts.kycTier < 1) {
    return { allowed: false, reason: 'KYC Tier 1 required to claim cleaning service profile' };
  }
  return { allowed: true };
}

export function guardClaimedToCacVerified(opts: {
  cacNumber: string | null;
}): FSMGuardResult {
  if (!opts.cacNumber) {
    return { allowed: false, reason: 'CAC registration number required for verification' };
  }
  return { allowed: true };
}

export const VALID_CLEANING_TRANSITIONS: Array<[CleaningServiceFSMState, CleaningServiceFSMState]> = [
  ['seeded',       'claimed'],
  ['claimed',      'cac_verified'],
  ['cac_verified', 'active'],
  ['active',       'suspended'],
  ['suspended',    'active'],
  ['claimed',      'suspended'],
];

export function isValidCleaningTransition(
  from: CleaningServiceFSMState,
  to: CleaningServiceFSMState,
): boolean {
  return VALID_CLEANING_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
