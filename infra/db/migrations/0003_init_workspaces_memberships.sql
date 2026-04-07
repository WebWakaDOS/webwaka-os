-- Migration: 0003_init_workspaces_memberships
-- Description: Create workspaces and memberships tables.
-- (TDR-0008, entitlement-model.md, Platform Invariant T3)

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id                  TEXT NOT NULL PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  name                TEXT NOT NULL,
  owner_type          TEXT NOT NULL CHECK (owner_type IN ('individual', 'organization')),
  owner_id            TEXT NOT NULL,
  subscription_plan   TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  -- Stored as JSON array of PlatformLayer strings
  active_layers       TEXT NOT NULL DEFAULT '["discovery"]',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- Memberships
-- Junction between users and workspaces with role assignment.
CREATE TABLE IF NOT EXISTS memberships (
  id           TEXT NOT NULL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('super_admin', 'admin', 'manager', 'agent', 'cashier', 'member')),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_workspace_id ON memberships(workspace_id);