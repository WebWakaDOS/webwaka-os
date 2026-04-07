/**
 * In-memory geography hierarchy helpers.
 *
 * These helpers operate over a pre-loaded map of GeographyNode objects.
 * In the API layer, the map is populated from D1; here it is injectable
 * for testability.
 *
 * (TDR-0011, geography-taxonomy.md)
 */

import type { PlaceId } from '@webwaka/types';
import type { GeographyNode, AncestryResult, GeographyRollupResult, GeographyRollupQuery } from './types.js';
import { GeographyType } from './types.js';

export type GeographyIndex = ReadonlyMap<PlaceId, GeographyNode>;

// ---------------------------------------------------------------------------
// Ancestry
// ---------------------------------------------------------------------------

/**
 * Returns the full ancestry chain for a given node, from root to node.
 * Throws if any ancestor is missing from the index (data integrity issue).
 */
export function getAncestry(nodeId: PlaceId, index: GeographyIndex): AncestryResult {
  const node = index.get(nodeId);
  if (!node) {
    throw new Error(`GeographyNode not found in index: ${nodeId}`);
  }

  const ancestors: GeographyNode[] = [];
  for (const ancestorId of node.ancestryPath) {
    const ancestor = index.get(ancestorId);
    if (!ancestor) {
      throw new Error(`Ancestor node missing from index: ${ancestorId} (for node ${nodeId})`);
    }
    ancestors.push(ancestor);
  }

  return {
    nodeId,
    ancestors,
    fullPath: [...ancestors, node],
  };
}

/**
 * Returns the immediate parent node, or null if root.
 */
export function getParent(nodeId: PlaceId, index: GeographyIndex): GeographyNode | null {
  const node = index.get(nodeId);
  if (!node) {
    throw new Error(`GeographyNode not found in index: ${nodeId}`);
  }
  if (node.parentId === null) return null;
  return index.get(node.parentId) ?? null;
}

/**
 * Returns the direct children of a node.
 */
export function getChildren(nodeId: PlaceId, index: GeographyIndex): ReadonlyArray<GeographyNode> {
  return Array.from(index.values()).filter((n) => n.parentId === nodeId);
}

// ---------------------------------------------------------------------------
// Rollup (aggregation)
// ---------------------------------------------------------------------------

/**
 * Returns all descendants of a node (at any depth), optionally filtered by type.
 *
 * This is the primary aggregation primitive used by discovery and reporting.
 *
 * Examples:
 * - All wards in an LGA: rollup(lgaId, { filterTypes: ['ward'] })
 * - All motor parks in a state: rollup(stateId, { filterTypes: ['motor_park'] })
 * - All places in Nigeria: rollup(nigeriaId)
 */
export function rollupDescendants(
  query: GeographyRollupQuery,
  index: GeographyIndex,
): GeographyRollupResult {
  const { rootId, filterTypes } = query;

  if (!index.has(rootId)) {
    throw new Error(`Root node not found in index: ${rootId}`);
  }

  const descendants: GeographyNode[] = [];

  // BFS over all nodes, collecting those whose ancestryPath includes rootId
  for (const node of index.values()) {
    if (node.id === rootId) continue;
    if (!node.ancestryPath.includes(rootId)) continue;

    if (filterTypes && filterTypes.length > 0) {
      if (!filterTypes.includes(node.geographyType)) continue;
    }
    descendants.push(node);
  }

  return {
    rootId,
    descendants,
    descendantIds: descendants.map((n) => n.id),
  };
}

/**
 * Checks whether `nodeId` is a descendant of `potentialAncestorId`.
 */
export function isDescendantOf(
  nodeId: PlaceId,
  potentialAncestorId: PlaceId,
  index: GeographyIndex,
): boolean {
  const node = index.get(nodeId);
  if (!node) return false;
  return node.ancestryPath.includes(potentialAncestorId);
}

/**
 * Returns all nodes of a specific geography type across the entire index.
 * Useful for queries like "all LGAs in Nigeria".
 */
export function getByType(
  type: GeographyType,
  index: GeographyIndex,
): ReadonlyArray<GeographyNode> {
  return Array.from(index.values()).filter((n) => n.geographyType === type);
}

/**
 * Builds a geography index from a flat array of nodes.
 * Validates that ancestry paths are consistent.
 */
export function buildIndex(nodes: ReadonlyArray<GeographyNode>): GeographyIndex {
  const map = new Map<PlaceId, GeographyNode>();
  for (const node of nodes) {
    map.set(node.id, node);
  }
  return map;
}

/**
 * Returns the path of node names from root to the given node.
 * Useful for display breadcrumbs.
 */
export function getBreadcrumb(nodeId: PlaceId, index: GeographyIndex): ReadonlyArray<string> {
  const { fullPath } = getAncestry(nodeId, index);
  return fullPath.map((n) => n.name);
}
