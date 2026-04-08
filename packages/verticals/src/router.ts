/**
 * packages/verticals — Vertical Router
 * WebWaka OS M8 — Verticals Framework
 *
 * Routes vertical operations to the correct per-vertical package.
 * All lookups are tenant-scoped (T3).
 */

import type {
  VerticalRecord,
  VerticalLookupResult,
  VerticalActivationContext,
  VerticalEntitlements,
} from './types.js';

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

/**
 * Look up a vertical by slug.
 * Returns the vertical definition (global registry — not tenant-scoped).
 */
export async function getVerticalBySlug(
  db: D1Like,
  slug: string,
): Promise<VerticalLookupResult> {
  const row = await db
    .prepare('SELECT * FROM verticals WHERE slug = ? AND status != ? LIMIT 1')
    .bind(slug, 'deprecated')
    .first<VerticalRecord>();

  if (!row) return { found: false };
  return { found: true, vertical: row };
}

/**
 * List all active verticals in a category.
 */
export async function listVerticalsByCategory(
  db: D1Like,
  category: string,
): Promise<VerticalRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM verticals WHERE category = ? AND status != ? ORDER BY priority ASC, display_name ASC')
    .bind(category, 'deprecated')
    .all<VerticalRecord>();
  return results;
}

/**
 * List all P1-Original verticals (priority = 1).
 */
export async function listOriginalVerticals(
  db: D1Like,
): Promise<VerticalRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM verticals WHERE priority = 1 AND status != ? ORDER BY category ASC, display_name ASC')
    .bind('deprecated')
    .all<VerticalRecord>();
  return results;
}

/**
 * Derive entitlements struct from a VerticalRecord.
 */
export function extractEntitlements(vertical: VerticalRecord): VerticalEntitlements {
  return {
    slug: vertical.slug,
    required_kyc_tier: vertical.required_kyc_tier,
    requires_frsc: vertical.requires_frsc === 1,
    requires_cac: vertical.requires_cac === 1,
    requires_it: vertical.requires_it === 1,
    requires_community: vertical.requires_community === 1,
    requires_social: vertical.requires_social === 1,
  };
}

/**
 * Check if an activation context satisfies vertical entitlements.
 * Returns a list of unmet requirements (empty = all satisfied).
 */
export function checkActivationRequirements(
  entitlements: VerticalEntitlements,
  ctx: VerticalActivationContext,
): string[] {
  const unmet: string[] = [];

  if (ctx.kycTier < entitlements.required_kyc_tier) {
    unmet.push(`KYC Tier ${entitlements.required_kyc_tier} required (current: Tier ${ctx.kycTier})`);
  }
  if (entitlements.requires_frsc && !ctx.frscVerified) {
    unmet.push('FRSC operator license verification required');
  }
  if (entitlements.requires_cac && !ctx.cacVerified) {
    unmet.push('CAC business registration verification required');
  }
  if (entitlements.requires_it && !ctx.itVerified) {
    unmet.push('CAC Incorporated Trustees (IT) registration verification required');
  }

  return unmet;
}

/**
 * Assert all vertical entitlements are satisfied.
 * Throws VerticalActivationError if any requirements are unmet.
 */
export class VerticalActivationError extends Error {
  constructor(
    public readonly slug: string,
    public readonly unmetRequirements: string[],
  ) {
    super(
      `Vertical '${slug}' activation blocked: ${unmetRequirements.join('; ')}`,
    );
    this.name = 'VerticalActivationError';
  }
}

export function assertVerticalActivationRequirements(
  entitlements: VerticalEntitlements,
  ctx: VerticalActivationContext,
): void {
  const unmet = checkActivationRequirements(entitlements, ctx);
  if (unmet.length > 0) {
    throw new VerticalActivationError(entitlements.slug, unmet);
  }
}
