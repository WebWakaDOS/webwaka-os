-- Migration: 0046_superagent_consents
-- Description: Per-user AI processing consent records for SuperAgent (SA-2.1).
-- Separate from consent_records (0017) which covers BVN/NIN/CAC identity lookups.
-- This table governs NDPR Article 2.1 consent for AI data-processing features.
-- Append-only: consent can be revoked (revoked_at set) but rows are never deleted.
-- Platform Invariant P10: consent required before any AI call.

CREATE TABLE IF NOT EXISTS superagent_consents (
  id                TEXT    NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  purpose           TEXT    NOT NULL DEFAULT 'ai_processing'
                            CHECK (purpose IN ('ai_processing', 'ai_personalization', 'ai_analytics')),
  consent_text_hash TEXT    NOT NULL,  -- SHA-256 of exact consent text shown (locale-specific)
  locale            TEXT    NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'pcm')),
  granted           INTEGER NOT NULL DEFAULT 1 CHECK (granted IN (0, 1)),
  granted_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  ip_hash           TEXT    NOT NULL,  -- SHA-256(PII_SALT + ip) — R7 compliant
  revoked_at        INTEGER             -- NULL = active; set on explicit user revocation
);

-- Active consent lookup (hot path — called on every AI request)
CREATE INDEX IF NOT EXISTS idx_sa_consent_active
  ON superagent_consents(user_id, tenant_id, purpose)
  WHERE revoked_at IS NULL;

-- Audit trail per tenant
CREATE INDEX IF NOT EXISTS idx_sa_consent_tenant_ts
  ON superagent_consents(tenant_id, granted_at DESC);
