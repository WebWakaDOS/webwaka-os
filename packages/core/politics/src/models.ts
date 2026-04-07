/**
 * Political data models.
 * (docs/governance/political-taxonomy.md)
 *
 * Objects defined:
 * - Jurisdiction (a specific territory instance)
 * - PoliticalAssignment (person holding office over jurisdiction)
 * - PartyAffiliation (individual ↔ party)
 * - CandidateRecord (pre-election)
 * - TermRecord (confirmed assignment window)
 */

import type {
  JurisdictionId,
  PoliticalAssignmentId,
  IndividualId,
  OrganizationId,
  PlaceId,
  TermId,
  PartyAffiliationId,
  TenantId,
} from '@webwaka/types';
import {
  PoliticalOfficeType,
  PoliticalTerritoryType,
  VerificationState,
} from '@webwaka/types';

// ---------------------------------------------------------------------------
// Jurisdiction
// A specific territory instance — e.g. "Ikeja Ward 03", "Lagos State"
// ---------------------------------------------------------------------------

export interface Jurisdiction {
  readonly id: JurisdictionId;
  /**
   * Links to the Place in the geography hierarchy.
   * e.g. a ward, a state, a country node.
   */
  readonly placeId: PlaceId;
  readonly territoryType: PoliticalTerritoryType;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Term Record
// The start/end window of a confirmed political assignment.
// ---------------------------------------------------------------------------

export interface TermRecord {
  readonly id: TermId;
  readonly startDate: string; // ISO 8601 date
  readonly endDate: string | null; // null = ongoing
  readonly confirmedAt: string | null; // null = not yet confirmed (candidate stage)
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Political Assignment
// A person's active holding of an office over a jurisdiction.
// ---------------------------------------------------------------------------

export interface PoliticalAssignment {
  readonly id: PoliticalAssignmentId;
  readonly individualId: IndividualId;
  readonly officeType: PoliticalOfficeType;
  readonly jurisdictionId: JurisdictionId;
  readonly termId: TermId;
  readonly verificationState: VerificationState;
  readonly tenantId: TenantId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Party Affiliation
// Association between an Individual and a political party (Organization).
// ---------------------------------------------------------------------------

export interface PartyAffiliation {
  readonly id: PartyAffiliationId;
  readonly individualId: IndividualId;
  /** Political party is modeled as an Organization entity. */
  readonly partyId: OrganizationId;
  readonly membershipNumber?: string;
  readonly joinedAt: string | null;
  readonly leftAt: string | null;
  readonly isPrimary: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Candidate Record (pre-election)
// ---------------------------------------------------------------------------

export interface CandidateRecord {
  readonly individualId: IndividualId;
  readonly officeType: PoliticalOfficeType;
  readonly jurisdictionId: JurisdictionId;
  readonly partyAffiliationId: PartyAffiliationId | null; // null = independent
  readonly electionDate: string; // ISO 8601 date
  readonly verificationState: VerificationState;
  readonly createdAt: string;
  readonly updatedAt: string;
}
