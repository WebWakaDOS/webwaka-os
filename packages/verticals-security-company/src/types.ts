/**
 * @webwaka/verticals-security-company — Domain types
 * M9 Commerce P2 Batch 2 — Task V-COMM-EXT-B7
 *
 * FSM: seeded → claimed → psc_verified → active → suspended
 * KYC gates:
 *   seeded → claimed: KYC Tier 1
 *   Payroll operations: KYC Tier 2
 *   Multi-estate contracts above ₦5M/month: KYC Tier 3
 * Platform Invariants: P9 (kobo integers), T3 (tenant_id always present)
 * P13: Guard PII (names, ID numbers) never passed to AI
 */

export type SecurityCompanyFSMState =
  | 'seeded'
  | 'claimed'
  | 'psc_verified'
  | 'active'
  | 'suspended';

export type GuardStatus = 'active' | 'suspended' | 'terminated';

export interface SecurityCompanyProfile {
  id: string;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  pscLicence: string | null;
  pscaiNumber: string | null;
  cacRc: string | null;
  guardCount: number;
  status: SecurityCompanyFSMState;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSecurityCompanyInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  companyName: string;
  pscLicence?: string | undefined;
  pscaiNumber?: string | undefined;
  cacRc?: string | undefined;
  guardCount?: number | undefined;
}

export interface UpdateSecurityCompanyInput {
  companyName?: string | undefined;
  pscLicence?: string | null | undefined;
  pscaiNumber?: string | null | undefined;
  cacRc?: string | null | undefined;
  guardCount?: number | undefined;
  status?: SecurityCompanyFSMState | undefined;
}

export interface SecurityGuard {
  id: string;
  workspaceId: string;
  tenantId: string;
  guardName: string;
  idNumber: string | null;
  trainingCert: string | null;
  deploymentSiteId: string | null;
  monthlySalaryKobo: number;
  status: GuardStatus;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSecurityGuardInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  guardName: string;
  idNumber?: string | undefined;
  trainingCert?: string | undefined;
  deploymentSiteId?: string | undefined;
  monthlySalaryKobo: number;
}

export interface SecuritySite {
  id: string;
  workspaceId: string;
  tenantId: string;
  siteName: string;
  clientPhone: string | null;
  address: string | null;
  state: string | null;
  guardCountRequired: number;
  monthlyFeeKobo: number;
  contractStart: number | null;
  contractEnd: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSecuritySiteInput {
  id?: string | undefined;
  workspaceId: string;
  tenantId: string;
  siteName: string;
  clientPhone?: string | undefined;
  address?: string | undefined;
  state?: string | undefined;
  guardCountRequired?: number | undefined;
  monthlyFeeKobo: number;
  contractStart?: number | undefined;
  contractEnd?: number | undefined;
}

export interface SecurityIncident {
  id: string;
  siteId: string;
  workspaceId: string;
  tenantId: string;
  reportDate: number;
  incidentType: string;
  description: string | null;
  guardId: string | null;
  actionTaken: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSecurityIncidentInput {
  id?: string | undefined;
  siteId: string;
  workspaceId: string;
  tenantId: string;
  reportDate: number;
  incidentType: string;
  description?: string | undefined;
  guardId?: string | undefined;
  actionTaken?: string | undefined;
}

export const VALID_SECURITY_COMPANY_TRANSITIONS: Record<SecurityCompanyFSMState, SecurityCompanyFSMState[]> = {
  seeded: ['claimed'],
  claimed: ['psc_verified', 'suspended'],
  psc_verified: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function isValidSecurityCompanyTransition(from: SecurityCompanyFSMState, to: SecurityCompanyFSMState): boolean {
  return VALID_SECURITY_COMPANY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function guardSeedToClaimed(ctx: { kycTier: number }): { allowed: boolean; reason?: string } {
  if (ctx.kycTier < 1) return { allowed: false, reason: 'KYC Tier 1 required to claim security company profile' };
  return { allowed: true };
}

export function guardClaimedToPscVerified(ctx: { pscLicence: string | null; pscaiNumber: string | null }): { allowed: boolean; reason?: string } {
  if (!ctx.pscLicence) return { allowed: false, reason: 'PSC licence required for psc_verified transition' };
  if (!ctx.pscaiNumber) return { allowed: false, reason: 'PSCAI number required for psc_verified transition' };
  return { allowed: true };
}
