-- Migration 0012 — Event Log
-- Milestone 6: Event Bus Layer
-- event_log is an append-only ordered log of domain events (aggregate-version keyed).

CREATE TABLE IF NOT EXISTS event_log (
  id           TEXT PRIMARY KEY,
  aggregate    TEXT NOT NULL,    -- entityType (individual, organization, profile, workspace, ...)
  aggregate_id TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  tenant_id    TEXT NOT NULL,
  payload      TEXT NOT NULL,    -- JSON
  version      INTEGER NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_log_aggregate_version
  ON event_log(aggregate, aggregate_id, version);

CREATE INDEX IF NOT EXISTS idx_event_log_tenant
  ON event_log(tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_log_event_type
  ON event_log(event_type);

CREATE INDEX IF NOT EXISTS idx_event_log_created
  ON event_log(created_at);
