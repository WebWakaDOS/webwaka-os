-- Migration: 0073_vertical_solar_installer.sql
-- Vertical: solar-installer (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → nerc_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)
-- Energy values stored as integers (watts, watt-hours) to avoid floats

CREATE TABLE IF NOT EXISTS solar_installer_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  nerc_registration TEXT,
  nemsa_cert TEXT,
  cac_rc TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_solar_installer_profiles_tenant ON solar_installer_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_solar_installer_profiles_workspace ON solar_installer_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS solar_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  address TEXT,
  system_size_watts INTEGER NOT NULL,
  panel_count INTEGER NOT NULL DEFAULT 0,
  battery_capacity_wh INTEGER NOT NULL DEFAULT 0,
  inverter_kva INTEGER NOT NULL DEFAULT 0,
  total_cost_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'survey' CHECK(status IN ('survey','design','procurement','installation','testing','handover','maintenance')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_solar_projects_workspace ON solar_projects(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_solar_projects_status ON solar_projects(status, tenant_id);

CREATE TABLE IF NOT EXISTS solar_components (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  component_type TEXT NOT NULL CHECK(component_type IN ('panel','battery','inverter','cable','charge_controller','other')),
  brand TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost_kobo INTEGER NOT NULL,
  supplier TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_solar_components_project ON solar_components(project_id, tenant_id);
