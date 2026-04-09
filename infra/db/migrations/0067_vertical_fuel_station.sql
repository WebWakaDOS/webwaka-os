-- Migration: 0067_vertical_fuel_station.sql
-- Vertical: fuel-station (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → nuprc_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)
-- Note: volumes stored as integer millilitres to avoid floats

CREATE TABLE IF NOT EXISTS fuel_station_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  nuprc_licence TEXT,
  nuprc_expiry INTEGER,
  dealer_type TEXT CHECK(dealer_type IN ('independent','nnpc_mega','total','ardova')),
  cac_number TEXT,
  state TEXT,
  lga TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_fuel_station_profiles_tenant ON fuel_station_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_station_profiles_workspace ON fuel_station_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS fuel_pumps (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  pump_number TEXT NOT NULL,
  product TEXT NOT NULL CHECK(product IN ('PMS','AGO','DPK')),
  current_price_kobo_per_litre INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_fuel_pumps_station ON fuel_pumps(station_id, tenant_id);

CREATE TABLE IF NOT EXISTS fuel_daily_readings (
  id TEXT PRIMARY KEY,
  pump_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  shift_date INTEGER NOT NULL,
  opening_meter INTEGER NOT NULL,
  closing_meter INTEGER NOT NULL,
  litres_sold_ml INTEGER NOT NULL,
  cash_received_kobo INTEGER NOT NULL,
  attendant_name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_fuel_daily_readings_pump ON fuel_daily_readings(pump_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_daily_readings_date ON fuel_daily_readings(shift_date, tenant_id);

CREATE TABLE IF NOT EXISTS fuel_tank_stock (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product TEXT NOT NULL CHECK(product IN ('PMS','AGO','DPK')),
  capacity_ml INTEGER NOT NULL DEFAULT 0,
  current_level_ml INTEGER NOT NULL DEFAULT 0,
  last_delivery_ml INTEGER NOT NULL DEFAULT 0,
  last_delivery_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_fuel_tank_stock_station ON fuel_tank_stock(station_id, tenant_id);
