-- infra/db/migrations/0022_agents.sql
-- Agent registry — field agents operating under a workspace/tenant
-- M7b: Offline Sync + USSD Gateway + POS Float Ledger

CREATE TABLE IF NOT EXISTS agents (
  id              TEXT NOT NULL PRIMARY KEY,
  individual_id   TEXT NOT NULL REFERENCES individuals(id),
  workspace_id    TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'decommissioned')),
  kyc_tier        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_individual ON agents(individual_id);
