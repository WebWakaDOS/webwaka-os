/**
 * @webwaka/verticals-solar-installer — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B8
 *
 * FSM: seeded → claimed → nerc_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   Standard residential: KYC Tier 2
 *   Commercial mini-grid above ₦5M: KYC Tier 3
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * Energy values stored as integers (watts, watt-hours)
 */

export type SolarInstallerFSMState =
  | 'seeded'
  | 'claimed'
  | 'nerc_verified'
  | 'active'
  | 'suspended';

export type SolarProjectStatus =
  | 'survey'
  | 'design'
  | 'procurement'
  | 'installation'
  | 'testing'
  | 'handover'
  | 'maintenance';

export type ComponentType = 'panel' | 'battery' | 'inverter' | 'cable' | 'charge_controller' | 'other';

export interface SolarInstallerProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  nercRegistration: string | null;
  nemsaCert: string | null;
  cacRc: string | null;
  status: SolarInstallerFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSolarInstallerInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  nercRegistration?: string | undefined;
  nemsaCert?: string | undefined;
  cacRc?: string | undefined;
}

export interface UpdateSolarInstallerInput {
  companyName?: string | undefined;
  nercRegistration?: string | null | undefined;
  nemsaCert?: string | null | undefined;
  cacRc?: string | null | undefined;
  status?: SolarInstallerFSMState | undefined;
}

export interface SolarProject {
  id: string;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  address: string | null;
  systemSizeWatts: number;
  panelCount: number;
  batteryCapacityWh: number;
  inverterKva: number;
  totalCostKobo: number;
  status: SolarProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSolarProjectInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  clientPhone: string;
  address?: string | undefined;
  systemSizeWatts: number;
  panelCount?: number | undefined;
  batteryCapacityWh?: number | undefined;
  inverterKva?: number | undefined;
  totalCostKobo: number;
}

export interface SolarComponent {
  id: string;
  projectId: string;
  workspaceId: string;
  tenantId: string;
  componentType: ComponentType;
  brand: string | null;
  quantity: number;
  unitCostKobo: number;
  supplier: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSolarComponentInput {
  id?: string | undefined;
  projectId: string;
  workspaceId: string;
  tenantId: string;
  componentType: ComponentType;
  brand?: string | undefined;
  quantity?: number | undefined;
  unitCostKobo: number;
  supplier?: string | undefined;
}

export const VALID_SOLAR_INSTALLER_TRANSITIONS: Record<SolarInstallerFSMState, SolarInstallerFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['nerc_verified', 'suspended'],
  nerc_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidSolarInstallerTransition(from: SolarInstallerFSMState, to: SolarInstallerFSMState): boolean {
  return VALID_SOLAR_INSTALLER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim solar installer profile' };
  return { allowed: true };
}

export function guardClaimedToNercVerified(ctx: { nercRegistration: string | null; nemsaCert: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.nercRegistration) return { allowed: false, reason: 'NERC registration required for nerc_verified transition' };
  if (!ctx.nemsaCert) return { allowed: false, reason: 'NEMSA cert required for nerc_verified transition' };
  return { allowed: true };
}
