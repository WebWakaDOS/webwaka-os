/**
 * Auth guards — Platform Invariant P13 enforcement (M7f).
 * (docs/governance/platform-invariants.md — P13: Primary Phone Mandatory)
 *
 * Note: This module uses inline D1 queries and MUST NOT import @webwaka/contact
 * to avoid circular dependency. The contact_channels query is duplicated intentionally.
 *
 * These guards are called at the auth/KYC middleware layer, before the route handler.
 */

// ---------------------------------------------------------------------------
// Local D1Like — defined inline (no imports from other packages)
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T>(): Promise<T | null>;
    };
  };
}

// ---------------------------------------------------------------------------
// AuthGuardError
// ---------------------------------------------------------------------------

export class AuthGuardError extends Error {
  constructor(
    public readonly code: 'PRIMARY_PHONE_REQUIRED',
    message: string,
  ) {
    super(message);
    this.name = 'AuthGuardError';
  }
}

// ---------------------------------------------------------------------------
// requirePrimaryPhoneVerified
// ---------------------------------------------------------------------------

/**
 * P13 — Primary phone mandatory guard.
 * Throws AuthGuardError('PRIMARY_PHONE_REQUIRED') if user has no verified primary SMS
 * contact channel. Must be called before any KYC Tier 1+ uplift operation.
 *
 * Implementation: inline D1 SELECT — does NOT import @webwaka/contact (avoids circular dep).
 *
 * @param db   - D1 binding
 * @param userId   - Authenticated user's ID
 * @param tenantId - Current tenant's ID (T3 compliance — userId is tenant-scoped)
 */
export async function requirePrimaryPhoneVerified(
  db: D1Like,
  userId: string,
  _tenantId: string,
): Promise<void> {
  const row = await db
    .prepare(
      `SELECT id FROM contact_channels
       WHERE user_id = ? AND channel_type = 'sms' AND is_primary = 1 AND verified = 1
       LIMIT 1`,
    )
    .bind(userId)
    .first<{ id: string }>();

  if (!row) {
    throw new AuthGuardError(
      'PRIMARY_PHONE_REQUIRED',
      'A verified primary phone number is required before this operation. (P13)',
    );
  }
}
