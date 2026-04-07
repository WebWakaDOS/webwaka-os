/**
 * Profile renderer — transforms a raw profile DB row into a renderable
 * view model, applying tenant branding + visibility rules.
 *
 * Milestone 6 — Frontend Composition Layer
 */

import type { TenantManifest } from './tenant-manifest.js';

// ---------------------------------------------------------------------------
// Source profile row from DB
// ---------------------------------------------------------------------------

export interface ProfileRow {
  id: string;
  entity_id: string;
  entity_type: string;
  display_name: string;
  headline: string | null;
  avatar_url: string | null;
  place_id: string | null;
  visibility: string;
  claim_status: string | null;
  content: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Rendered view model
// ---------------------------------------------------------------------------

export interface RenderedProfile {
  id: string;
  entityId: string;
  entityType: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  placeId: string | null;
  isVerified: boolean;
  isClaimed: boolean;
  content: Record<string, unknown>;
  branding: {
    primaryColour: string;
    secondaryColour: string;
    logoUrl?: string;
    fontFamily?: string;
  };
  canClaim: boolean;
}

// ---------------------------------------------------------------------------
// renderProfile — combines profile row + tenant manifest
// ---------------------------------------------------------------------------

/**
 * Render a profile for public display within a tenant context.
 */
export function renderProfile(
  row: ProfileRow,
  manifest: TenantManifest,
): RenderedProfile {
  const isClaimed = row.claim_status === 'approved';
  const isVerified = isClaimed;

  let content: Record<string, unknown> = {};
  if (row.content) {
    try {
      content = JSON.parse(row.content) as Record<string, unknown>;
    } catch {
      // ignore parse errors
    }
  }

  return {
    id: row.id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    displayName: row.display_name,
    headline: row.headline,
    avatarUrl: row.avatar_url,
    placeId: row.place_id,
    isVerified,
    isClaimed,
    content,
    branding: {
      primaryColour: manifest.branding.primaryColour,
      secondaryColour: manifest.branding.secondaryColour,
      ...(manifest.branding.logoUrl !== undefined ? { logoUrl: manifest.branding.logoUrl } : {}),
      ...(manifest.branding.fontFamily !== undefined ? { fontFamily: manifest.branding.fontFamily } : {}),
    },
    canClaim: !isClaimed && manifest.features.claimsEnabled,
  };
}

// ---------------------------------------------------------------------------
// renderProfileList — batch rendering for discovery page
// ---------------------------------------------------------------------------

export function renderProfileList(
  rows: ProfileRow[],
  manifest: TenantManifest,
): RenderedProfile[] {
  return rows
    .filter((r) => r.visibility === 'public' || r.visibility === 'semi')
    .map((r) => renderProfile(r, manifest));
}
