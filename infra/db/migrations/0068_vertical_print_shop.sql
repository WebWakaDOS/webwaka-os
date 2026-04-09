-- Migration: 0068_vertical_print_shop.sql
-- Vertical: print-shop (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → cac_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS print_shop_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  cac_number TEXT,
  son_registered INTEGER NOT NULL DEFAULT 0,
  speciality TEXT CHECK(speciality IN ('digital','offset','large_format','all')),
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_print_shop_profiles_tenant ON print_shop_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_print_shop_profiles_workspace ON print_shop_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK(job_type IN ('flyer','banner','brochure','packaging','signage','other')),
  quantity INTEGER NOT NULL DEFAULT 1,
  size TEXT,
  paper_type TEXT,
  colour_mode TEXT CHECK(colour_mode IN ('full_colour','black_white','spot')),
  unit_price_kobo INTEGER NOT NULL,
  total_kobo INTEGER NOT NULL,
  design_ref TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','proof_sent','approved','printing','ready','delivered')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_workspace ON print_jobs(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status, tenant_id);

CREATE TABLE IF NOT EXISTS print_stock (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  paper_type TEXT NOT NULL,
  gsm INTEGER,
  sheet_size TEXT,
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  unit_cost_kobo INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_print_stock_workspace ON print_stock(workspace_id, tenant_id);
