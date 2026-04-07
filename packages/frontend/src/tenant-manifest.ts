/**
 * Tenant manifest — configuration document that governs how a tenant's
 * frontend is rendered (branding, feature flags, discovery visibility).
 *
 * Fetched once per request from D1 and cached in KV.
 *
 * Milestone 6 — Frontend Composition Layer
 */

// ---------------------------------------------------------------------------
// Tenant manifest shape
// ---------------------------------------------------------------------------

export interface TenantBranding {
  primaryColour: string;
  secondaryColour: string;
  logoUrl?: string;
  faviconUrl?: string;
  fontFamily?: string;
}

export interface TenantFeatureFlags {
  discoveryEnabled: boolean;
  claimsEnabled: boolean;
  paymentsEnabled: boolean;
  analyticsEnabled: boolean;
}

export interface TenantManifest {
  tenantId: string;
  tenantSlug: string;
  displayName: string;
  branding: TenantBranding;
  features: TenantFeatureFlags;
  allowedEntityTypes: string[];
  defaultLocale: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Default manifest values (used when no DB override exists)
// ---------------------------------------------------------------------------

const DEFAULT_BRANDING: TenantBranding = {
  primaryColour: '#1a1a2e',
  secondaryColour: '#e94560',
  fontFamily: 'Inter, sans-serif',
};

const DEFAULT_FEATURES: TenantFeatureFlags = {
  discoveryEnabled: true,
  claimsEnabled: true,
  paymentsEnabled: false,
  analyticsEnabled: false,
};

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface WorkspaceRow {
  id: string;
  tenant_slug: string | null;
  display_name: string;
  branding: string | null;
  features: string | null;
  updated_at: string;
}

interface D1Like {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    run(): Promise<{ success: boolean }>;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

// ---------------------------------------------------------------------------
// buildTenantManifest — load manifest from DB row
// ---------------------------------------------------------------------------

/**
 * Resolve a TenantManifest from a workspace row.
 * Falls back to defaults for missing branding/feature fields.
 */
export function buildTenantManifest(row: WorkspaceRow): TenantManifest {
  const branding: TenantBranding = {
    ...DEFAULT_BRANDING,
    ...(row.branding ? (JSON.parse(row.branding) as Partial<TenantBranding>) : {}),
  };
  const features: TenantFeatureFlags = {
    ...DEFAULT_FEATURES,
    ...(row.features ? (JSON.parse(row.features) as Partial<TenantFeatureFlags>) : {}),
  };
  return {
    tenantId: row.id,
    tenantSlug: row.tenant_slug ?? row.id,
    displayName: row.display_name,
    branding,
    features,
    allowedEntityTypes: ['individual', 'organization'],
    defaultLocale: 'en-NG',
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch a tenant manifest by its slug.
 * Returns null if the slug is not found.
 */
export async function getTenantManifestBySlug(
  db: D1Like,
  slug: string,
): Promise<TenantManifest | null> {
  const row = await db
    .prepare(
      `SELECT w.id, w.tenant_slug, w.display_name, w.branding, w.features,
              datetime(w.updated_at,'unixepoch') AS updated_at
       FROM workspaces w
       WHERE w.tenant_slug = ? AND w.status = 'active'`,
    )
    .bind(slug)
    .first<WorkspaceRow>();

  if (!row) return null;
  return buildTenantManifest(row);
}

/**
 * Fetch a tenant manifest by workspace ID.
 * Returns null if the workspace is not found / inactive.
 */
export async function getTenantManifestById(
  db: D1Like,
  workspaceId: string,
): Promise<TenantManifest | null> {
  const row = await db
    .prepare(
      `SELECT w.id, w.tenant_slug, w.display_name, w.branding, w.features,
              datetime(w.updated_at,'unixepoch') AS updated_at
       FROM workspaces w
       WHERE w.id = ?`,
    )
    .bind(workspaceId)
    .first<WorkspaceRow>();

  if (!row) return null;
  return buildTenantManifest(row);
}
