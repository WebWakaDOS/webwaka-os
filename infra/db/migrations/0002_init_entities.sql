-- Migration: 0002_init_entities
-- Description: Create individuals and organizations tables (root entities).
-- (universal-entity-model.md, Platform Invariant T3)

-- Individuals
CREATE TABLE IF NOT EXISTS individuals (
  id                 TEXT NOT NULL PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  middle_name        TEXT,
  display_name       TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'unverified',
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_individuals_tenant_id ON individuals(tenant_id);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id                  TEXT NOT NULL PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  name                TEXT NOT NULL,
  registration_number TEXT,
  verification_state  TEXT NOT NULL DEFAULT 'unverified',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_organizations_tenant_id ON organizations(tenant_id);