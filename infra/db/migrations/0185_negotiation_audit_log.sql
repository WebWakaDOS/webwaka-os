-- Migration 0185: Negotiable Pricing — Negotiation Audit Log
-- P9: amount_kobo is INTEGER (nullable — present only for price events).
-- T3: tenant_id NOT NULL.
-- Immutable append-only log. No updated_at. No DELETE cascade.
-- event_type values: session_opened | offer_submitted | countered | accepted |
--                    declined | expired | cancelled | auto_accepted
-- actor_type: buyer | seller | system

CREATE TABLE IF NOT EXISTS negotiation_audit_log (
  id           TEXT    PRIMARY KEY,
  tenant_id    TEXT    NOT NULL,
  session_id   TEXT    NOT NULL REFERENCES negotiation_sessions(id),
  event_type   TEXT    NOT NULL,
  actor_type   TEXT    NOT NULL CHECK (actor_type IN ('buyer','seller','system')),
  actor_ref_id TEXT    NOT NULL,
  amount_kobo  INTEGER,
  metadata     TEXT    NOT NULL DEFAULT '{}',
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_neg_audit_session
  ON negotiation_audit_log(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_neg_audit_tenant
  ON negotiation_audit_log(tenant_id, event_type, created_at);
