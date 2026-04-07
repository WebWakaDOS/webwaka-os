/**
 * Discovery page view model — the data shape powering the public /discover page
 * for a given tenant (search results + facets + pagination).
 *
 * Milestone 6 — Frontend Composition Layer
 */

import type { TenantManifest } from './tenant-manifest.js';
import type { RenderedProfile } from './profile-renderer.js';

// ---------------------------------------------------------------------------
// Discovery query params
// ---------------------------------------------------------------------------

export interface DiscoveryQuery {
  tenantSlug: string;
  q?: string;
  entityType?: string;
  placeId?: string;
  page?: number;
  perPage?: number;
}

// ---------------------------------------------------------------------------
// Discovery page model
// ---------------------------------------------------------------------------

export interface DiscoveryFacet {
  label: string;
  value: string;
  count: number;
}

export interface DiscoveryPage {
  manifest: TenantManifest;
  profiles: RenderedProfile[];
  query: DiscoveryQuery;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  facets: {
    entityTypes: DiscoveryFacet[];
    places: DiscoveryFacet[];
  };
}

// ---------------------------------------------------------------------------
// buildDiscoveryPage — compose the view model from resolved data
// ---------------------------------------------------------------------------

export function buildDiscoveryPage(
  manifest: TenantManifest,
  profiles: RenderedProfile[],
  total: number,
  query: DiscoveryQuery,
  facets?: { entityTypes?: DiscoveryFacet[]; places?: DiscoveryFacet[] },
): DiscoveryPage {
  const page = query.page ?? 1;
  const perPage = query.perPage ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return {
    manifest,
    profiles,
    query,
    total,
    page,
    perPage,
    totalPages,
    facets: {
      entityTypes: facets?.entityTypes ?? [],
      places: facets?.places ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// normaliseQuery — clean up raw query param values
// ---------------------------------------------------------------------------

export function normaliseDiscoveryQuery(
  raw: Record<string, string | undefined>,
): DiscoveryQuery {
  const page = raw['page'] ? Math.max(1, parseInt(raw['page'], 10)) : 1;
  const perPage = raw['perPage'] ? Math.min(100, Math.max(1, parseInt(raw['perPage'], 10))) : 20;

  const query: DiscoveryQuery = { tenantSlug: raw['tenantSlug'] ?? '', page, perPage };
  if (raw['q'] !== undefined) query.q = raw['q'];
  if (raw['entityType'] !== undefined) query.entityType = raw['entityType'];
  if (raw['placeId'] !== undefined) query.placeId = raw['placeId'];
  return query;
}
