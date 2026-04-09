/**
 * SuperAgent Consent Service — SA-2.1
 * WebWaka OS — NDPR AI Processing Consent (P10)
 *
 * Manages per-user AI processing consent records in `superagent_consents`.
 * Separate from identity consent (consent_records/0017) which governs BVN/NIN lookups.
 *
 * P10: Every AI call must be preceded by a successful consent check.
 * P13: Consent text hashes are stored, not raw text. IP is hashed before storage.
 */

// ---------------------------------------------------------------------------
// D1 interface (minimal — avoids binding @cloudflare/workers-types)
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiConsentPurpose = 'ai_processing' | 'ai_personalization' | 'ai_analytics';
export type AiConsentLocale = 'en' | 'pcm';

export interface AiConsentRecord {
  id: string;
  user_id: string;
  tenant_id: string;
  purpose: AiConsentPurpose;
  consent_text_hash: string;
  locale: AiConsentLocale;
  granted: 1 | 0;
  granted_at: number;
  ip_hash: string;
  revoked_at: number | null;
}

export interface GrantConsentInput {
  userId: string;
  tenantId: string;
  purpose: AiConsentPurpose;
  /** SHA-256 of the exact consent text shown to the user in their locale */
  consentTextHash: string;
  locale: AiConsentLocale;
  /** SHA-256(PII_SALT + raw_ip) — never store raw IP */
  ipHash: string;
}

export interface ConsentStatus {
  granted: boolean;
  consentId: string | null;
  grantedAt: number | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Grant AI processing consent for a user.
 * Inserts a new consent record; does not overwrite previous records (audit trail).
 *
 * Callers must:
 *   1. Hash the displayed consent text (SHA-256) and pass as consentTextHash.
 *   2. Hash the user's IP (SHA-256(PII_SALT + ip)) and pass as ipHash.
 *   3. Never log or store raw PII (P13).
 */
export async function grantAiConsent(
  db: D1Like,
  input: GrantConsentInput,
): Promise<{ consentId: string }> {
  const id = crypto.randomUUID().replace(/-/g, '');
  await db
    .prepare(
      `INSERT INTO superagent_consents
         (id, user_id, tenant_id, purpose, consent_text_hash, locale, granted, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .bind(
      id,
      input.userId,
      input.tenantId,
      input.purpose,
      input.consentTextHash,
      input.locale,
      input.ipHash,
    )
    .run();

  return { consentId: id };
}

/**
 * Revoke AI processing consent for a user.
 * Sets revoked_at on all active records for the given (user, tenant, purpose) tuple.
 * Returns the number of records revoked.
 */
export async function revokeAiConsent(
  db: D1Like,
  userId: string,
  tenantId: string,
  purpose: AiConsentPurpose = 'ai_processing',
): Promise<{ revoked: number }> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE superagent_consents
          SET revoked_at = ?
        WHERE user_id = ? AND tenant_id = ? AND purpose = ? AND revoked_at IS NULL`,
    )
    .bind(now, userId, tenantId, purpose)
    .run();

  const row = await db
    .prepare(
      `SELECT COUNT(*) as n FROM superagent_consents
        WHERE user_id = ? AND tenant_id = ? AND purpose = ? AND revoked_at = ?`,
    )
    .bind(userId, tenantId, purpose, now)
    .first<{ n: number }>();

  return { revoked: row?.n ?? 0 };
}

/**
 * Check whether a user has active AI consent for the given purpose.
 * Returns ConsentStatus — callers decide how to handle non-consented state
 * (never throw here; let auth guards throw).
 */
export async function getAiConsentStatus(
  db: D1Like,
  userId: string,
  tenantId: string,
  purpose: AiConsentPurpose = 'ai_processing',
): Promise<ConsentStatus> {
  const row = await db
    .prepare(
      `SELECT id, granted, granted_at FROM superagent_consents
        WHERE user_id = ? AND tenant_id = ? AND purpose = ? AND revoked_at IS NULL
        ORDER BY granted_at DESC
        LIMIT 1`,
    )
    .bind(userId, tenantId, purpose)
    .first<{ id: string; granted: 0 | 1; granted_at: number }>();

  if (!row || row.granted !== 1) {
    return { granted: false, consentId: null, grantedAt: null };
  }
  return { granted: true, consentId: row.id, grantedAt: row.granted_at };
}

/**
 * List all consent records for a user (active + revoked) — for audit/DSAR purposes.
 */
export async function listAiConsents(
  db: D1Like,
  userId: string,
  tenantId: string,
): Promise<AiConsentRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM superagent_consents
        WHERE user_id = ? AND tenant_id = ?
        ORDER BY granted_at DESC`,
    )
    .bind(userId, tenantId)
    .all<AiConsentRecord>();

  return results;
}
