-- Migration: 0069_vertical_property_developer.sql
-- Vertical: property-developer (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → surcon_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)
-- KYC Tier 3 mandatory (high-value property transactions)

CREATE TABLE IF NOT EXISTS property_developer_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  surcon_number TEXT,
  toprec_number TEXT,
  cac_rc TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_property_developer_profiles_tenant ON property_developer_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_developer_profiles_workspace ON property_developer_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS property_estates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  estate_name TEXT NOT NULL,
  location TEXT,
  state TEXT,
  lga TEXT,
  land_title_type TEXT CHECK(land_title_type IN ('C_of_O','Deed','Gazette','Excision')),
  permit_number TEXT,
  total_units INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planning' CHECK(status IN ('planning','active','sold_out','completed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_property_estates_tenant ON property_estates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_estates_workspace ON property_estates(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS property_units (
  id TEXT PRIMARY KEY,
  estate_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK(unit_type IN ('1bed','2bed','3bed','duplex','bungalow','commercial')),
  unit_number TEXT NOT NULL,
  floor_area_sqm INTEGER NOT NULL,
  price_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','allocated','completed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_property_units_estate ON property_units(estate_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_units_status ON property_units(status, tenant_id);

CREATE TABLE IF NOT EXISTS property_allocations (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  total_price_kobo INTEGER NOT NULL,
  deposit_kobo INTEGER NOT NULL,
  instalment_plan TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','defaulted')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_property_allocations_unit ON property_allocations(unit_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_allocations_workspace ON property_allocations(workspace_id, tenant_id);
