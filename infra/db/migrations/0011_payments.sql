-- Migration 0011 — Payments / Billing History
-- Milestone 6: Payments Layer (Paystack integration)
-- billing_history tracks payment transactions per workspace/subscription.

CREATE TABLE IF NOT EXISTS billing_history (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  subscription_id TEXT REFERENCES subscriptions(id),
  paystack_ref    TEXT UNIQUE,
  amount_naira    INTEGER NOT NULL,  -- stored as kobo (T4: no floats)
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|success|failed|refunded
  metadata        TEXT NOT NULL DEFAULT '{}',       -- JSON
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_billing_workspace
  ON billing_history(workspace_id);

CREATE INDEX IF NOT EXISTS idx_billing_status
  ON billing_history(status);

CREATE INDEX IF NOT EXISTS idx_billing_paystack_ref
  ON billing_history(paystack_ref)
  WHERE paystack_ref IS NOT NULL;
