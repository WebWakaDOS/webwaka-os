-- Migration: 0071_vertical_restaurant_chain.sql
-- Vertical: restaurant-chain (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → nafdac_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)
-- Note: distinct from P1 restaurant (single-outlet); uses restaurant_chain_* tables

CREATE TABLE IF NOT EXISTS restaurant_chain_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  nafdac_number TEXT,
  cac_rc TEXT,
  outlet_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_restaurant_chain_profiles_tenant ON restaurant_chain_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_chain_profiles_workspace ON restaurant_chain_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS restaurant_chain_outlets (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  outlet_name TEXT NOT NULL,
  address TEXT,
  state TEXT,
  lga TEXT,
  nafdac_outlet_cert TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_restaurant_chain_outlets_brand ON restaurant_chain_outlets(brand_id, tenant_id);

CREATE TABLE IF NOT EXISTS restaurant_chain_menus (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('starter','main','side','dessert','drink','snack')),
  price_kobo INTEGER NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  prep_time_minutes INTEGER NOT NULL DEFAULT 15,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_restaurant_chain_menus_outlet ON restaurant_chain_menus(outlet_id, tenant_id);

CREATE TABLE IF NOT EXISTS restaurant_chain_orders (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  table_number TEXT,
  order_type TEXT NOT NULL CHECK(order_type IN ('dine_in','takeaway','delivery')),
  items TEXT NOT NULL DEFAULT '[]',
  total_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed' CHECK(status IN ('placed','kitchen','ready','served','paid')),
  customer_phone TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_restaurant_chain_orders_outlet ON restaurant_chain_orders(outlet_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_chain_orders_status ON restaurant_chain_orders(status, tenant_id);
