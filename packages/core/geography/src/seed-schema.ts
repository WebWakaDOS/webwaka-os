/**
 * Seed data schema and structure for Nigerian geography.
 *
 * The full seed data (36 states + FCT, 774 LGAs, 8,814 wards) is loaded
 * into D1 as part of the Milestone 2 database bootstrap per TDR-0011.
 *
 * This file defines the structure. Actual seed CSVs/JSON live in
 * infra/db/seed/ and are applied via wrangler d1 migrations.
 */

import type { PlaceId } from '@webwaka/types';
import { GeographyType } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Nigeria's 6 geopolitical zones
// ---------------------------------------------------------------------------

export const NIGERIA_GEOPOLITICAL_ZONES = [
  'North Central',
  'North East',
  'North West',
  'South East',
  'South South',
  'South West',
] as const;

export type NigeriaGeopoliticalZone = (typeof NIGERIA_GEOPOLITICAL_ZONES)[number];

// ---------------------------------------------------------------------------
// Seed record shapes (matches D1 places table)
// ---------------------------------------------------------------------------

export interface GeographySeedRecord {
  readonly id: string; // Will be cast to PlaceId at runtime
  readonly name: string;
  readonly geography_type: GeographyType;
  readonly parent_id: string | null;
  readonly ancestry_path: string; // JSON array of IDs stored as text in D1
  readonly tenant_id: null; // Shared geography — no tenant scope
}

// ---------------------------------------------------------------------------
// Nigeria root constants
// These IDs are fixed and seeded — they never change.
// ---------------------------------------------------------------------------

export const NIGERIA_ID = 'place_nigeria_001' as PlaceId;

export const ZONE_IDS: Record<NigeriaGeopoliticalZone, PlaceId> = {
  'North Central': 'place_zone_north_central' as PlaceId,
  'North East': 'place_zone_north_east' as PlaceId,
  'North West': 'place_zone_north_west' as PlaceId,
  'South East': 'place_zone_south_east' as PlaceId,
  'South South': 'place_zone_south_south' as PlaceId,
  'South West': 'place_zone_south_west' as PlaceId,
};

// ---------------------------------------------------------------------------
// Seed count reference (TDR-0011)
// ---------------------------------------------------------------------------

export const NIGERIA_SEED_COUNTS = {
  country: 1,
  geopoliticalZones: 6,
  states: 37, // 36 states + FCT
  lgas: 774,
  wards: 8814,
} as const;

/**
 * Builds the ancestry path string for D1 storage.
 * Stored as a JSON array e.g. '["place_nigeria_001","place_zone_north_central"]'
 */
export function buildAncestryPathString(ancestorIds: ReadonlyArray<PlaceId>): string {
  return JSON.stringify(ancestorIds);
}

/**
 * Parses the ancestry path string from D1.
 */
export function parseAncestryPath(raw: string): ReadonlyArray<PlaceId> {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid ancestry_path format: ${raw}`);
  }
  return parsed as PlaceId[];
}
