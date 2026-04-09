-- Migration: 0066_vertical_construction.sql
-- Vertical: construction (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → coren_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS construction_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  coren_number TEXT,
  corbon_number TEXT,
  bpp_registration TEXT,
  bpp_category TEXT CHECK(bpp_category IN ('A','B','C')),
  cac_number TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_construction_profiles_tenant ON construction_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_construction_profiles_workspace ON construction_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS construction_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  location TEXT NOT NULL,
  contract_value_kobo INTEGER NOT NULL,
  start_date INTEGER,
  expected_end_date INTEGER,
  status TEXT NOT NULL DEFAULT 'bid' CHECK(status IN ('bid','awarded','in_progress','completed','defects_liability')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_construction_projects_tenant ON construction_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_construction_projects_workspace ON construction_projects(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS construction_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  amount_kobo INTEGER NOT NULL,
  due_date INTEGER,
  paid_date INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','invoiced','paid')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_construction_milestones_project ON construction_milestones(project_id, tenant_id);

CREATE TABLE IF NOT EXISTS construction_materials (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost_kobo INTEGER NOT NULL,
  supplier TEXT,
  procurement_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_construction_materials_project ON construction_materials(project_id, tenant_id);
