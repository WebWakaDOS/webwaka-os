/**
 * Tests for geography hierarchy helpers.
 * (TDR-0011, geography-taxonomy.md)
 */

import { describe, it, expect } from 'vitest';
import type { GeographyNode } from './types.js';
import { GeographyType, GeographyLevel } from './types.js';
import {
  buildIndex,
  getAncestry,
  getParent,
  getChildren,
  rollupDescendants,
  isDescendantOf,
  getByType,
  getBreadcrumb,
} from './hierarchy.js';
import type { PlaceId } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Test fixtures: minimal Nigerian geography hierarchy
// ---------------------------------------------------------------------------

const NIGERIA_ID = 'place_nigeria_001' as PlaceId;
const SOUTH_WEST_ID = 'place_zone_south_west' as PlaceId;
const LAGOS_ID = 'place_state_lagos' as PlaceId;
const IKEJA_LGA_ID = 'place_lga_ikeja' as PlaceId;
const WARD_01_ID = 'place_ward_ikeja_01' as PlaceId;
const MARKET_ID = 'place_market_computer_village' as PlaceId;

const FIXTURE_NODES: GeographyNode[] = [
  {
    id: NIGERIA_ID,
    name: 'Nigeria',
    geographyType: GeographyType.Country,
    level: GeographyLevel.Country,
    parentId: null,
    ancestryPath: [],
    tenantId: null,
  },
  {
    id: SOUTH_WEST_ID,
    name: 'South West',
    geographyType: GeographyType.GeopoliticalZone,
    level: GeographyLevel.GeopoliticalZone,
    parentId: NIGERIA_ID,
    ancestryPath: [NIGERIA_ID],
    tenantId: null,
  },
  {
    id: LAGOS_ID,
    name: 'Lagos',
    geographyType: GeographyType.State,
    level: GeographyLevel.State,
    parentId: SOUTH_WEST_ID,
    ancestryPath: [NIGERIA_ID, SOUTH_WEST_ID],
    tenantId: null,
  },
  {
    id: IKEJA_LGA_ID,
    name: 'Ikeja',
    geographyType: GeographyType.LocalGovernmentArea,
    level: GeographyLevel.LocalGovernmentArea,
    parentId: LAGOS_ID,
    ancestryPath: [NIGERIA_ID, SOUTH_WEST_ID, LAGOS_ID],
    tenantId: null,
  },
  {
    id: WARD_01_ID,
    name: 'Ikeja Ward 01',
    geographyType: GeographyType.Ward,
    level: GeographyLevel.Ward,
    parentId: IKEJA_LGA_ID,
    ancestryPath: [NIGERIA_ID, SOUTH_WEST_ID, LAGOS_ID, IKEJA_LGA_ID],
    tenantId: null,
  },
  {
    id: MARKET_ID,
    name: 'Computer Village Market',
    geographyType: GeographyType.Market,
    level: GeographyLevel.FacilityPlace,
    parentId: IKEJA_LGA_ID,
    ancestryPath: [NIGERIA_ID, SOUTH_WEST_ID, LAGOS_ID, IKEJA_LGA_ID],
    tenantId: null,
  },
];

const INDEX = buildIndex(FIXTURE_NODES);

// ---------------------------------------------------------------------------
// buildIndex
// ---------------------------------------------------------------------------

describe('buildIndex', () => {
  it('builds a map with all nodes', () => {
    expect(INDEX.size).toBe(6);
    expect(INDEX.has(NIGERIA_ID)).toBe(true);
    expect(INDEX.has(MARKET_ID)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAncestry
// ---------------------------------------------------------------------------

describe('getAncestry', () => {
  it('returns empty ancestors for the root country node', () => {
    const result = getAncestry(NIGERIA_ID, INDEX);
    expect(result.ancestors).toHaveLength(0);
    expect(result.fullPath).toHaveLength(1);
    expect(result.fullPath[0]?.id).toBe(NIGERIA_ID);
  });

  it('returns correct ancestry for a ward', () => {
    const result = getAncestry(WARD_01_ID, INDEX);
    expect(result.ancestors).toHaveLength(4);
    expect(result.ancestors.map((n) => n.id)).toEqual([
      NIGERIA_ID,
      SOUTH_WEST_ID,
      LAGOS_ID,
      IKEJA_LGA_ID,
    ]);
    expect(result.fullPath).toHaveLength(5);
    expect(result.fullPath[4]?.id).toBe(WARD_01_ID);
  });

  it('throws if node is not in index', () => {
    expect(() => getAncestry('unknown_id' as PlaceId, INDEX)).toThrow('not found in index');
  });
});

// ---------------------------------------------------------------------------
// getParent
// ---------------------------------------------------------------------------

describe('getParent', () => {
  it('returns null for the root node', () => {
    expect(getParent(NIGERIA_ID, INDEX)).toBeNull();
  });

  it('returns the direct parent', () => {
    const parent = getParent(LAGOS_ID, INDEX);
    expect(parent?.id).toBe(SOUTH_WEST_ID);
  });
});

// ---------------------------------------------------------------------------
// getChildren
// ---------------------------------------------------------------------------

describe('getChildren', () => {
  it('returns direct children of a node', () => {
    const children = getChildren(IKEJA_LGA_ID, INDEX);
    const childIds = children.map((c) => c.id);
    expect(childIds).toContain(WARD_01_ID);
    expect(childIds).toContain(MARKET_ID);
    expect(children).toHaveLength(2);
  });

  it('returns empty array for leaf nodes', () => {
    expect(getChildren(WARD_01_ID, INDEX)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// rollupDescendants
// ---------------------------------------------------------------------------

describe('rollupDescendants', () => {
  it('returns all descendants of Nigeria', () => {
    const result = rollupDescendants({ rootId: NIGERIA_ID }, INDEX);
    expect(result.descendants).toHaveLength(5); // all nodes except Nigeria itself
    expect(result.descendantIds).toContain(MARKET_ID);
  });

  it('filters by type when filterTypes is provided', () => {
    const result = rollupDescendants(
      { rootId: NIGERIA_ID, filterTypes: [GeographyType.Ward] },
      INDEX,
    );
    expect(result.descendants).toHaveLength(1);
    expect(result.descendants[0]?.id).toBe(WARD_01_ID);
  });

  it('filters markets in an LGA', () => {
    const result = rollupDescendants(
      { rootId: IKEJA_LGA_ID, filterTypes: [GeographyType.Market] },
      INDEX,
    );
    expect(result.descendants).toHaveLength(1);
    expect(result.descendants[0]?.geographyType).toBe(GeographyType.Market);
  });

  it('returns empty for leaf node', () => {
    const result = rollupDescendants({ rootId: MARKET_ID }, INDEX);
    expect(result.descendants).toHaveLength(0);
  });

  it('throws if root is not in index', () => {
    expect(() =>
      rollupDescendants({ rootId: 'missing_id' as PlaceId }, INDEX),
    ).toThrow('Root node not found');
  });
});

// ---------------------------------------------------------------------------
// isDescendantOf
// ---------------------------------------------------------------------------

describe('isDescendantOf', () => {
  it('returns true for a ward under Nigeria', () => {
    expect(isDescendantOf(WARD_01_ID, NIGERIA_ID, INDEX)).toBe(true);
  });

  it('returns true for Lagos under South West', () => {
    expect(isDescendantOf(LAGOS_ID, SOUTH_WEST_ID, INDEX)).toBe(true);
  });

  it('returns false for Nigeria under Lagos (inverted)', () => {
    expect(isDescendantOf(NIGERIA_ID, LAGOS_ID, INDEX)).toBe(false);
  });

  it('returns false for sibling nodes', () => {
    expect(isDescendantOf(WARD_01_ID, MARKET_ID, INDEX)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getByType
// ---------------------------------------------------------------------------

describe('getByType', () => {
  it('returns all states', () => {
    const states = getByType(GeographyType.State, INDEX);
    expect(states).toHaveLength(1);
    expect(states[0]?.id).toBe(LAGOS_ID);
  });

  it('returns all markets', () => {
    const markets = getByType(GeographyType.Market, INDEX);
    expect(markets).toHaveLength(1);
    expect(markets[0]?.id).toBe(MARKET_ID);
  });
});

// ---------------------------------------------------------------------------
// getBreadcrumb
// ---------------------------------------------------------------------------

describe('getBreadcrumb', () => {
  it('returns name path from root to node', () => {
    const crumb = getBreadcrumb(WARD_01_ID, INDEX);
    expect(crumb).toEqual(['Nigeria', 'South West', 'Lagos', 'Ikeja', 'Ikeja Ward 01']);
  });

  it('returns single name for root', () => {
    const crumb = getBreadcrumb(NIGERIA_ID, INDEX);
    expect(crumb).toEqual(['Nigeria']);
  });
});
