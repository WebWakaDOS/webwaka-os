-- Migration 0188 — Fix P9 violation: confidence REAL → INTEGER basis points
-- confidence stored as INTEGER 0–10000 where 10000 = 100.00% confidence.
-- Existing values (0.0–1.0 float) multiplied by 10000 and cast to INTEGER.

ALTER TABLE community_moderation_log RENAME COLUMN confidence TO confidence_bps;

UPDATE community_moderation_log SET
  confidence_bps = CAST(confidence_bps * 10000 AS INTEGER);
