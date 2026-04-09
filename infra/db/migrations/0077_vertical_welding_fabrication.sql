-- Migration: 0077_vertical_welding_fabrication.sql
-- Vertical: welding-fabrication (M10 Commerce P2 Batch 2)
-- FSM: seeded → claimed → active (3-state informal pattern)
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS welding_shop_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  cac_or_trade_number TEXT,
  speciality TEXT NOT NULL CHECK(speciality IN ('gate','structural','tank','general')),
  state TEXT,
  lga TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_welding_shop_profiles_tenant ON welding_shop_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_welding_shop_profiles_workspace ON welding_shop_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS welding_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  description TEXT NOT NULL,
  material_cost_kobo INTEGER NOT NULL,
  labour_cost_kobo INTEGER NOT NULL,
  total_kobo INTEGER NOT NULL,
  delivery_date INTEGER,
  status TEXT NOT NULL DEFAULT 'quoted' CHECK(status IN ('quoted','confirmed','in_progress','completed','collected')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_welding_jobs_workspace ON welding_jobs(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_welding_jobs_status ON welding_jobs(status, tenant_id);

CREATE TABLE IF NOT EXISTS welding_materials (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK(unit IN ('kg','metre','sheet','piece')),
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  unit_cost_kobo INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_welding_materials_workspace ON welding_materials(workspace_id, tenant_id);
