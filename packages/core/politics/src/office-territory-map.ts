/**
 * Canonical mapping between political office types and their territory scopes.
 * (docs/governance/political-taxonomy.md)
 *
 * Rule: Political roles must be modeled as structured assignments over
 * territories, NOT as loose labels attached to people.
 */

import { PoliticalOfficeType, PoliticalTerritoryType } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Office → Territory mapping
// ---------------------------------------------------------------------------

/**
 * The canonical territory type for each political office.
 * Every office type maps to exactly one territory type.
 */
export const OFFICE_TERRITORY_MAP: Readonly<
  Record<PoliticalOfficeType, PoliticalTerritoryType>
> = {
  [PoliticalOfficeType.Councilor]: PoliticalTerritoryType.Ward,
  [PoliticalOfficeType.LocalGovernmentChairman]: PoliticalTerritoryType.LocalGovernmentArea,
  [PoliticalOfficeType.StateHouseOfAssemblyMember]: PoliticalTerritoryType.StateConstituency,
  [PoliticalOfficeType.HouseOfRepresentativesMember]: PoliticalTerritoryType.FederalConstituency,
  [PoliticalOfficeType.Senator]: PoliticalTerritoryType.SenatorialDistrict,
  [PoliticalOfficeType.Governor]: PoliticalTerritoryType.State,
  [PoliticalOfficeType.President]: PoliticalTerritoryType.Country,
};

/**
 * Returns the expected territory type for a given office type.
 */
export function getExpectedTerritoryType(
  officeType: PoliticalOfficeType,
): PoliticalTerritoryType {
  return OFFICE_TERRITORY_MAP[officeType];
}

/**
 * Validates that an office type matches a territory type.
 * Returns true if valid, false if the combination is invalid.
 */
export function validateOfficeTerritoryMatch(
  officeType: PoliticalOfficeType,
  territoryType: PoliticalTerritoryType,
): boolean {
  return OFFICE_TERRITORY_MAP[officeType] === territoryType;
}

/**
 * Returns all office types that operate at a given territory level.
 */
export function getOfficesForTerritoryType(
  territoryType: PoliticalTerritoryType,
): ReadonlyArray<PoliticalOfficeType> {
  return (Object.entries(OFFICE_TERRITORY_MAP) as Array<[PoliticalOfficeType, PoliticalTerritoryType]>)
    .filter(([, territory]) => territory === territoryType)
    .map(([office]) => office);
}
