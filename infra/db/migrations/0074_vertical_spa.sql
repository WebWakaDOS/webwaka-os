-- Migration: 0074_vertical_spa.sql
-- Vertical: spa (M10 Commerce P2 Batch 2)
-- FSM: seeded → claimed → permit_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)
-- P13: Client health intake data never passed to AI

CREATE TABLE IF NOT EXISTS spa_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  spa_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('day_spa','hotel_spa','mobile')),
  nasc_number TEXT,
  state_health_permit TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_spa_profiles_tenant ON spa_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spa_profiles_workspace ON spa_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS spa_services (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('massage','facial','body','nail','other')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  price_kobo INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_spa_services_workspace ON spa_services(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS spa_appointments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  service_id TEXT NOT NULL,
  therapist_id TEXT,
  room_number TEXT,
  appointment_time INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','confirmed','in_session','completed','cancelled','no_show')),
  deposit_kobo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_spa_appointments_workspace ON spa_appointments(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_time ON spa_appointments(appointment_time, tenant_id);

CREATE TABLE IF NOT EXISTS spa_memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  package_name TEXT NOT NULL,
  monthly_fee_kobo INTEGER NOT NULL,
  sessions_per_month INTEGER NOT NULL DEFAULT 4,
  sessions_used INTEGER NOT NULL DEFAULT 0,
  valid_until INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_spa_memberships_workspace ON spa_memberships(workspace_id, tenant_id);
