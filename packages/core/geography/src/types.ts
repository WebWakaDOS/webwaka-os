/**
 * Geography-specific types extending the canonical geography types.
 * (docs/governance/geography-taxonomy.md, TDR-0011)
 */

import type { PlaceId, TenantId } from '@webwaka/types';
import { GeographyType, GeographyLevel, FACILITY_GEOGRAPHY_TYPES } from '@webwaka/types';

export { GeographyType, GeographyLevel };

// ---------------------------------------------------------------------------
// Place node in the geography hierarchy
// ---------------------------------------------------------------------------

/**
 * A lightweight geography node used for hierarchy traversal.
 * The full Place entity is in @webwaka/types.
 */
export interface GeographyNode {
  readonly id: PlaceId;
  readonly name: string;
  readonly geographyType: GeographyType;
  readonly level: GeographyLevel;
  readonly parentId: PlaceId | null;
  /** Ordered list of ancestor IDs from root (country) to immediate parent. */
  readonly ancestryPath: ReadonlyArray<PlaceId>;
  /** Optional tenant scoping. Null for shared geography (states, LGAs, wards). */
  readonly tenantId: TenantId | null;
}

// ---------------------------------------------------------------------------
// Ancestry result
// ---------------------------------------------------------------------------

export interface AncestryResult {
  readonly nodeId: PlaceId;
  readonly ancestors: ReadonlyArray<GeographyNode>;
  /** The full path including the node itself (root first). */
  readonly fullPath: ReadonlyArray<GeographyNode>;
}

// ---------------------------------------------------------------------------
// Rollup query input/output
// ---------------------------------------------------------------------------

export interface GeographyRollupQuery {
  /** Geography node to roll up from (all descendants included). */
  readonly rootId: PlaceId;
  /** Optionally filter to specific geography types within the rollup. */
  readonly filterTypes?: ReadonlyArray<GeographyType>;
}

export interface GeographyRollupResult {
  readonly rootId: PlaceId;
  readonly descendants: ReadonlyArray<GeographyNode>;
  readonly descendantIds: ReadonlyArray<PlaceId>;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isFacilityType(type: GeographyType): boolean {
  return FACILITY_GEOGRAPHY_TYPES.has(type);
}

export function isAdministrativeType(type: GeographyType): boolean {
  return !isFacilityType(type);
}

/**
 * Maps a GeographyType to its canonical hierarchy level.
 * Facility types are all level 8.
 */
export function geographyTypeToLevel(type: GeographyType): GeographyLevel {
  const map: Record<GeographyType, GeographyLevel> = {
    [GeographyType.Country]: GeographyLevel.Country,
    [GeographyType.GeopoliticalZone]: GeographyLevel.GeopoliticalZone,
    [GeographyType.State]: GeographyLevel.State,
    [GeographyType.LocalGovernmentArea]: GeographyLevel.LocalGovernmentArea,
    [GeographyType.Ward]: GeographyLevel.Ward,
    [GeographyType.Community]: GeographyLevel.Community,
    [GeographyType.Household]: GeographyLevel.Household,
    [GeographyType.Market]: GeographyLevel.FacilityPlace,
    [GeographyType.MotorPark]: GeographyLevel.FacilityPlace,
    [GeographyType.Warehouse]: GeographyLevel.FacilityPlace,
    [GeographyType.Office]: GeographyLevel.FacilityPlace,
    [GeographyType.Branch]: GeographyLevel.FacilityPlace,
    [GeographyType.Hub]: GeographyLevel.FacilityPlace,
    [GeographyType.ConstituencyOffice]: GeographyLevel.FacilityPlace,
    [GeographyType.Campus]: GeographyLevel.FacilityPlace,
    [GeographyType.Clinic]: GeographyLevel.FacilityPlace,
    [GeographyType.School]: GeographyLevel.FacilityPlace,
  };
  const level = map[type];
  if (level === undefined) {
    throw new Error(`Unknown GeographyType: ${type}`);
  }
  return level;
}
