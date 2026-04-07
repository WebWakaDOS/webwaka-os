/**
 * Tests for political office-to-territory validation rules.
 * (political-taxonomy.md)
 */

import { describe, it, expect } from 'vitest';
import { PoliticalOfficeType, PoliticalTerritoryType } from '@webwaka/types';
import {
  OFFICE_TERRITORY_MAP,
  getExpectedTerritoryType,
  validateOfficeTerritoryMatch,
  getOfficesForTerritoryType,
} from './office-territory-map.js';

describe('OFFICE_TERRITORY_MAP completeness', () => {
  it('covers all office types', () => {
    const allOffices = Object.values(PoliticalOfficeType);
    for (const office of allOffices) {
      expect(OFFICE_TERRITORY_MAP).toHaveProperty(office);
    }
  });
});

describe('getExpectedTerritoryType', () => {
  it('maps Councilor → Ward', () => {
    expect(getExpectedTerritoryType(PoliticalOfficeType.Councilor))
      .toBe(PoliticalTerritoryType.Ward);
  });

  it('maps LocalGovernmentChairman → LocalGovernmentArea', () => {
    expect(getExpectedTerritoryType(PoliticalOfficeType.LocalGovernmentChairman))
      .toBe(PoliticalTerritoryType.LocalGovernmentArea);
  });

  it('maps StateHouseOfAssemblyMember → StateConstituency', () => {
    expect(getExpectedTerritoryType(PoliticalOfficeType.StateHouseOfAssemblyMember))
      .toBe(PoliticalTerritoryType.StateConstituency);
  });

  it('maps HouseOfRepresentativesMember → FederalConstituency', () => {
    expect(getExpectedTerritoryType(PoliticalOfficeType.HouseOfRepresentativesMember))
      .toBe(PoliticalTerritoryType.FederalConstituency);
  });

  it('maps Senator → SenatorialDistrict', () => {
    expect(getExpectedTerritoryType(PoliticalOfficeType.Senator))
      .toBe(PoliticalTerritoryType.SenatorialDistrict);
  });

  it('maps Governor → State', () => {
    expect(getExpectedTerritoryType(PoliticalOfficeType.Governor))
      .toBe(PoliticalTerritoryType.State);
  });

  it('maps President → Country', () => {
    expect(getExpectedTerritoryType(PoliticalOfficeType.President))
      .toBe(PoliticalTerritoryType.Country);
  });
});

describe('validateOfficeTerritoryMatch', () => {
  it('returns true for valid Councilor + Ward', () => {
    expect(
      validateOfficeTerritoryMatch(PoliticalOfficeType.Councilor, PoliticalTerritoryType.Ward),
    ).toBe(true);
  });

  it('returns true for valid Senator + SenatorialDistrict', () => {
    expect(
      validateOfficeTerritoryMatch(PoliticalOfficeType.Senator, PoliticalTerritoryType.SenatorialDistrict),
    ).toBe(true);
  });

  it('returns false for invalid Councilor + State', () => {
    expect(
      validateOfficeTerritoryMatch(PoliticalOfficeType.Councilor, PoliticalTerritoryType.State),
    ).toBe(false);
  });

  it('returns false for invalid Governor + Ward', () => {
    expect(
      validateOfficeTerritoryMatch(PoliticalOfficeType.Governor, PoliticalTerritoryType.Ward),
    ).toBe(false);
  });

  it('returns false for Senator + Country (wrong level)', () => {
    expect(
      validateOfficeTerritoryMatch(PoliticalOfficeType.Senator, PoliticalTerritoryType.Country),
    ).toBe(false);
  });
});

describe('getOfficesForTerritoryType', () => {
  it('returns Councilor for Ward territory', () => {
    const offices = getOfficesForTerritoryType(PoliticalTerritoryType.Ward);
    expect(offices).toContain(PoliticalOfficeType.Councilor);
    expect(offices).toHaveLength(1);
  });

  it('returns President for Country territory', () => {
    const offices = getOfficesForTerritoryType(PoliticalTerritoryType.Country);
    expect(offices).toContain(PoliticalOfficeType.President);
    expect(offices).toHaveLength(1);
  });

  it('returns empty for a territory type with no offices yet', () => {
    // StateConstituency only maps StateHouseOfAssemblyMember
    const offices = getOfficesForTerritoryType(PoliticalTerritoryType.StateConstituency);
    expect(offices).toContain(PoliticalOfficeType.StateHouseOfAssemblyMember);
  });
});
