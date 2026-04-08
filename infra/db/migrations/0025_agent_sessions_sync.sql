-- infra/db/migrations/0025_agent_sessions_sync.sql
-- Agent sessions + server-side sync queue log (mirrors Dexie.js client queue for audit)
-- Platform Invariant P11: Sync FIFO — server-wins on conflict
-- M7b: Offline Sync + USSD Gateway + POS Float Ledger

CREATE TABLE IF NOT EXISTS agent_sessions (
  id                TEXT NOT NULL PRIMARY KEY,
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  terminal_id       TEXT REFERENCES pos_terminals(id),    -- NULL for mobile agents
  started_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  ended_at          INTEGER,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  total_kobo        INTEGER NOT NULL DEFAULT 0,
  sync_status       TEXT NOT NULL DEFAULT 'online'
                    CHECK (sync_status IN ('online', 'offline_queued', 'synced')),
  tenant_id         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON agent_sessions(agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON agent_sessions(tenant_id);

-- Server-side sync log — mirrors Dexie.js client queue for audit
CREATE TABLE IF NOT EXISTS sync_queue_log (
  id               TEXT NOT NULL PRIMARY KEY,
  client_id        TEXT NOT NULL UNIQUE,      -- Client-generated UUID — UNIQUE for P11 idempotency
  agent_id         TEXT,
  entity_type      TEXT NOT NULL,
  operation        TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  payload          TEXT NOT NULL,             -- JSON
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'applied', 'conflict')),
  conflict_reason  TEXT,
  applied_at       INTEGER,
  tenant_id        TEXT NOT NULL,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sync_agent ON sync_queue_log(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_tenant ON sync_queue_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_client_id ON sync_queue_log(client_id);
