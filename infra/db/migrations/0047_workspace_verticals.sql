-- Migration: 0047_workspace_verticals
-- Description: Workspace-vertical activation state (M8a).
-- Tracks which verticals each workspace has activated and their FSM state.
-- Each row is the FSM node for one (workspace, vertical) pair.
-- Platform Invariant T3: tenant_id on all rows for cross-tenant safety.

CREATE TABLE IF NOT EXISTS workspace_verticals (
  id             TEXT    NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id   TEXT    NOT NULL,
  tenant_id      TEXT    NOT NULL,
  vertical_slug  TEXT    NOT NULL REFERENCES verticals(slug),
  state          TEXT    NOT NULL DEFAULT 'claimed'
                         CHECK (state IN ('seeded','claimed','active','suspended','deprecated')),
  activated_at   INTEGER,         -- set when state → active
  suspended_at   INTEGER,         -- set when state → suspended
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch()),

  -- One FSM record per vertical per workspace
  UNIQUE (workspace_id, vertical_slug)
);

-- Hot path: look up all verticals for a workspace
CREATE INDEX IF NOT EXISTS idx_wv_workspace
  ON workspace_verticals(workspace_id, tenant_id, state);

-- Admin queries: find all workspaces using a vertical
CREATE INDEX IF NOT EXISTS idx_wv_vertical_state
  ON workspace_verticals(vertical_slug, state);

-- T3: tenant isolation
CREATE INDEX IF NOT EXISTS idx_wv_tenant
  ON workspace_verticals(tenant_id, vertical_slug);
