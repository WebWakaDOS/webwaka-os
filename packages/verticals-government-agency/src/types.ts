/**
 * @webwaka/verticals-government-agency — types + FSM guards (M11)
 * FSM: seeded → claimed → bpp_registered → active → suspended
 * AI: L3 HITL MANDATORY for ALL government budget and procurement AI output
 * P9: all monetary values in kobo integers
 * P13: vendor_ref opaque; procurement details NEVER to AI
 * T3: all queries scoped to tenant_id
 * KYC: Tier 3 mandatory — government fund management
 */

export type GovernmentAgencyFSMState =
  | 'seeded'
  | 'claimed'
  | 'bpp_registered'
  | 'active'
  | 'suspended';

export type ProcurementCategory = 'goods' | 'services' | 'works';
export type ProcurementStatus = 'open' | 'evaluated' | 'awarded' | 'completed';

const FSM_TRANSITIONS: Record<GovernmentAgencyFSMState, GovernmentAgencyFSMState[]> = {
  seeded:         ['claimed'],
  claimed:        ['bpp_registered'],
  bpp_registered: ['active'],
  active:         ['suspended'],
  suspended:      ['active'],
};

export function isValidGovernmentAgencyTransition(from: GovernmentAgencyFSMState, to: GovernmentAgencyFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToBppRegistered(input: { bppRegistration: string | null }): GuardResult {
  if (!input.bppRegistration || input.bppRegistration.trim() === '') {
    return { allowed: false, reason: 'BPP registration required for government agency MDA' };
  }
  return { allowed: true };
}

export function guardL3HitlRequired(input: { hitlApproved: boolean | undefined }): GuardResult {
  if (!input.hitlApproved) {
    return { allowed: false, reason: 'L3 HITL approval MANDATORY for all government agency AI output — no exceptions' };
  }
  return { allowed: true };
}

export function guardNoVendorOrProcurementInAi(payload: Record<string, unknown>): GuardResult {
  const forbidden = [
    'vendor_ref', 'vendorRef', 'procurement_ref', 'procurementRef',
    'bpp_approval_ref', 'bppApprovalRef', 'budget_line_item', 'budgetLineItem',
  ];
  for (const key of forbidden) {
    if (key in payload) return { allowed: false, reason: `P13: procurement/vendor data "${key}" must not pass to AI` };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface GovernmentAgencyProfile {
  id: string; workspaceId: string; tenantId: string;
  agencyName: string; mdaCode: string | null; bppRegistration: string | null;
  tsaCompliance: boolean; state: string; ministry: string | null;
  status: GovernmentAgencyFSMState; createdAt: number; updatedAt: number;
}

export interface MdaAppropriation {
  id: string; profileId: string; tenantId: string;
  fiscalYear: string; budgetLineItem: string;
  allocatedKobo: number; releasedKobo: number; spentKobo: number;
  createdAt: number; updatedAt: number;
}

export interface MdaProcurement {
  id: string; profileId: string; tenantId: string;
  procurementRef: string; bppApprovalRef: string | null;
  vendorRef: string; amountKobo: number;
  category: ProcurementCategory; status: ProcurementStatus;
  createdAt: number; updatedAt: number;
}

export interface MdaIgrCollection {
  id: string; profileId: string; tenantId: string;
  revenueType: string; collectionDate: number; amountKobo: number; receiptRef: string;
  createdAt: number; updatedAt: number;
}

export interface CreateGovernmentAgencyInput {
  id?: string; workspaceId: string; tenantId: string;
  agencyName: string; mdaCode?: string; bppRegistration?: string;
  tsaCompliance?: boolean; state: string; ministry?: string;
}

export interface CreateMdaAppropriationInput {
  id?: string; profileId: string; tenantId: string;
  fiscalYear: string; budgetLineItem: string;
  allocatedKobo: number; releasedKobo?: number; spentKobo?: number;
}

export interface CreateMdaProcurementInput {
  id?: string; profileId: string; tenantId: string;
  procurementRef: string; bppApprovalRef?: string;
  vendorRef: string; amountKobo: number;
  category: ProcurementCategory;
}

export interface CreateMdaIgrCollectionInput {
  id?: string; profileId: string; tenantId: string;
  revenueType: string; collectionDate: number; amountKobo: number; receiptRef: string;
}
