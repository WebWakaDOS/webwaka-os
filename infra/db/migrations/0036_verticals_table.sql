-- Migration 0036: Verticals Registry Table
-- Purpose: Master registry of all WebWaka OS vertical modules (150+)
-- Priority: 1=original (pre-Top100), 2=high-fit (Top100 ≥30/30), 3=medium (Top100 20-29)
-- Status: planned → active → deprecated
-- Date: 2026-04-09

CREATE TABLE IF NOT EXISTS verticals (
  id                    TEXT PRIMARY KEY,
  slug                  TEXT UNIQUE NOT NULL,
  display_name          TEXT NOT NULL,
  category              TEXT NOT NULL
    CHECK (category IN ('politics','transport','civic','commerce','health',
                        'education','professional','creator','place','financial',
                        'agricultural','media','institutional','social')),
  subcategory           TEXT,
  priority              INTEGER NOT NULL DEFAULT 3
    CHECK (priority IN (1, 2, 3)),
  status                TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','active','deprecated')),
  entity_type           TEXT NOT NULL DEFAULT 'organization'
    CHECK (entity_type IN ('individual','organization','place','offering')),
  fsm_states            TEXT NOT NULL DEFAULT '[]',
  required_kyc_tier     INTEGER NOT NULL DEFAULT 1
    CHECK (required_kyc_tier IN (0, 1, 2, 3)),
  requires_frsc         INTEGER NOT NULL DEFAULT 0,
  requires_cac          INTEGER NOT NULL DEFAULT 0,
  requires_it           INTEGER NOT NULL DEFAULT 0,
  requires_community    INTEGER NOT NULL DEFAULT 0,
  requires_social       INTEGER NOT NULL DEFAULT 0,
  package_name          TEXT,
  milestone_target      TEXT,
  notes                 TEXT,
  created_at            INTEGER DEFAULT (unixepoch()),
  updated_at            INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_verticals_category    ON verticals(category);
CREATE INDEX IF NOT EXISTS idx_verticals_priority    ON verticals(priority);
CREATE INDEX IF NOT EXISTS idx_verticals_status      ON verticals(status);
CREATE INDEX IF NOT EXISTS idx_verticals_entity_type ON verticals(entity_type);
CREATE INDEX IF NOT EXISTS idx_verticals_kyc_tier    ON verticals(required_kyc_tier);

-- Add vertical_id FK to workspaces (workspace ↔ vertical registry link)
ALTER TABLE workspaces ADD COLUMN vertical_id TEXT REFERENCES verticals(id);
CREATE INDEX IF NOT EXISTS idx_workspaces_vertical_id ON workspaces(vertical_id);
