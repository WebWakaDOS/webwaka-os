-- Migration: 0004_init_subscriptions
-- Description: Create subscriptions table.
-- (entitlement-model.md, Platform Invariant T5)

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    TEXT NOT NULL PRIMARY KEY,
  workspace_id          TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tenant_id             TEXT NOT NULL,
  plan                  TEXT NOT NULL DEFAULT 'free',
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'suspended')),
  -- Unix timestamps
  current_period_start  INTEGER NOT NULL,
  current_period_end    INTEGER NOT NULL,
  cancel_at_period_end  INTEGER NOT NULL DEFAULT 0, -- SQLite boolean (0/1)
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);