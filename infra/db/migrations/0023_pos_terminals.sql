-- infra/db/migrations/0023_pos_terminals.sql
-- POS terminal registry — hardware terminals assigned to agents
-- M7b: Offline Sync + USSD Gateway + POS Float Ledger

CREATE TABLE IF NOT EXISTS pos_terminals (
  id              TEXT NOT NULL PRIMARY KEY,
  terminal_ref    TEXT NOT NULL UNIQUE,    -- Hardware terminal ID
  agent_id        TEXT NOT NULL REFERENCES agents(id),
  workspace_id    TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'decommissioned')),
  model           TEXT,                    -- e.g. 'Verifone VX520'
  last_seen_at    INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pos_agent ON pos_terminals(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_workspace ON pos_terminals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pos_tenant ON pos_terminals(tenant_id);
