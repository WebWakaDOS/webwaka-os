-- Migration: 0076_vertical_travel_agent.sql
-- Vertical: travel-agent (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → nanta_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS travel_agent_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  nanta_number TEXT,
  iata_code TEXT,
  cac_rc TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_travel_agent_profiles_tenant ON travel_agent_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_travel_agent_profiles_workspace ON travel_agent_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS travel_packages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  destination TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('holiday','hajj','umrah','corporate','domestic')),
  duration_days INTEGER NOT NULL DEFAULT 1,
  price_per_pax_kobo INTEGER NOT NULL,
  inclusions TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_travel_packages_workspace ON travel_packages(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_travel_packages_type ON travel_packages(type, tenant_id);

CREATE TABLE IF NOT EXISTS travel_bookings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  package_id TEXT NOT NULL,
  travel_date INTEGER NOT NULL,
  pax_count INTEGER NOT NULL DEFAULT 1,
  total_kobo INTEGER NOT NULL,
  deposit_kobo INTEGER NOT NULL,
  balance_kobo INTEGER NOT NULL,
  visa_status TEXT NOT NULL DEFAULT 'not_required' CHECK(visa_status IN ('not_required','applied','approved','rejected')),
  status TEXT NOT NULL DEFAULT 'enquiry' CHECK(status IN ('enquiry','confirmed','paid','departed','completed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_travel_bookings_workspace ON travel_bookings(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_travel_bookings_status ON travel_bookings(status, tenant_id);
