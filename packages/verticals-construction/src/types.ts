/**
 * @webwaka/verticals-construction — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B1
 *
 * FSM: seeded → claimed → coren_verified → active → suspended
 * KYC gates:
 *   seeded → claimed:         KYC Tier 1
 *   coren_verified → active:  COREN + CORBON numbers required
 *   Contracts above ₦10M (1_000_000_000 kobo): KYC Tier 3
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 */

export type ConstructionFSMState =
  | 'seeded'
  | 'claimed'
  | 'coren_verified'
  | 'active'
  | 'suspended';

export type BPPCategory = 'A' | 'B' | 'C';

export type ProjectStatus =
  | 'bid'
  | 'awarded'
  | 'in_progress'
  | 'completed'
  | 'defects_liability';

export type MilestoneStatus = 'pending' | 'invoiced' | 'paid';

export interface ConstructionProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  corenNumber: string | null;
  corbonNumber: string | null;
  bppRegistration: string | null;
  bppCategory: BPPCategory | null;
  cacNumber: string | null;
  status: ConstructionFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateConstructionInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  corenNumber?: string | undefined;
  corbonNumber?: string | undefined;
  bppRegistration?: string | undefined;
  bppCategory?: BPPCategory | undefined;
  cacNumber?: string | undefined;
}

export interface UpdateConstructionInput {
  companyName?: string | undefined;
  corenNumber?: string | null | undefined;
  corbonNumber?: string | null | undefined;
  bppRegistration?: string | null | undefined;
  bppCategory?: BPPCategory | null | undefined;
  cacNumber?: string | null | undefined;
  status?: ConstructionFSMState | undefined;
}

export interface ConstructionProject {
  id: string;
  workspaceId: string;
  tenantId: string;
  projectName: string;
  clientName: string;
  clientPhone: string;
  location: string;
  contractValueKobo: number;
  startDate: number | null;
  expectedEndDate: number | null;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateConstructionProjectInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  projectName: string;
  clientName: string;
  clientPhone: string;
  location: string;
  contractValueKobo: number;
  startDate?: number | undefined;
  expectedEndDate?: number | undefined;
}

export interface ConstructionMilestone {
  id: string;
  projectId: string;
  workspaceId: string;
  tenantId: string;
  milestoneName: string;
  amountKobo: number;
  dueDate: number | null;
  paidDate: number | null;
  status: MilestoneStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateMilestoneInput {
  id?: string | undefined;
  projectId: string;
  workspaceId: string;
  tenantId: string;
  milestoneName: string;
  amountKobo: number;
  dueDate?: number | undefined;
}

export interface ConstructionMaterial {
  id: string;
  projectId: string;
  workspaceId: string;
  tenantId: string;
  materialName: string;
  quantity: number;
  unitCostKobo: number;
  supplier: string | null;
  procurementDate: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateMaterialInput {
  id?: string | undefined;
  projectId: string;
  workspaceId: string;
  tenantId: string;
  materialName: string;
  quantity?: number | undefined;
  unitCostKobo: number;
  supplier?: string | undefined;
  procurementDate?: number | undefined;
}

export const VALID_CONSTRUCTION_TRANSITIONS: Record<ConstructionFSMState, ConstructionFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['coren_verified', 'suspended'],
  coren_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidConstructionTransition(from: ConstructionFSMState, to: ConstructionFSMState): boolean {
  return VALID_CONSTRUCTION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim construction profile' };
  return { allowed: true };
}

export function guardClaimedToCorenVerified(ctx: { corenNumber: string | null; corbonNumber: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.corenNumber) return { allowed: false, reason: 'COREN number required for coren_verified transition' };
  if (!ctx.corbonNumber) return { allowed: false, reason: 'CORBON number required for coren_verified transition' };
  return { allowed: true };
}
