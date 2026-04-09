-- Migration: 0075_vertical_tailor.sql
-- Vertical: tailor (M10 Commerce P2 Batch 2)
-- FSM: seeded → claimed → active (3-state informal pattern)
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)
-- Measurements stored as integer cm×10 to avoid floats

CREATE TABLE IF NOT EXISTS tailor_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('bespoke','aso-ebi','ready-to-wear','all')),
  cac_or_trade_assoc_number TEXT,
  state TEXT,
  lga TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tailor_profiles_tenant ON tailor_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tailor_profiles_workspace ON tailor_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS tailor_clients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  measurements TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tailor_clients_workspace ON tailor_clients(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tailor_clients_phone ON tailor_clients(client_phone, tenant_id);

CREATE TABLE IF NOT EXISTS tailor_orders (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  style_description TEXT NOT NULL,
  fabric_type TEXT,
  delivery_date INTEGER,
  price_kobo INTEGER NOT NULL,
  deposit_kobo INTEGER NOT NULL,
  balance_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'intake' CHECK(status IN ('intake','cutting','sewing','finishing','ready','collected')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tailor_orders_client ON tailor_orders(client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tailor_orders_workspace ON tailor_orders(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS tailor_fabric_stock (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  fabric_name TEXT NOT NULL,
  colour TEXT,
  fabric_type TEXT,
  metres_available_cm INTEGER NOT NULL DEFAULT 0,
  cost_per_metre_kobo INTEGER NOT NULL,
  supplier TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tailor_fabric_stock_workspace ON tailor_fabric_stock(workspace_id, tenant_id);
