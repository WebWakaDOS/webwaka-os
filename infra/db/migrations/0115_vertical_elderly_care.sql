-- Migration 0115 — Elderly Care Facility vertical (M12)
-- Platform Invariants: T3 (tenant_id NOT NULL), P9 (monetary in kobo)
-- P13: resident_ref_id opaque — no clinical data in primary DB

CREATE TABLE IF NOT EXISTS elderly_care_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  fmhsw_registration TEXT,
  state_social_welfare_cert TEXT,
  cac_rc TEXT,
  bed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_elderly_profiles_tenant ON elderly_care_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_elderly_profiles_workspace ON elderly_care_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS care_residents (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  resident_ref_id TEXT NOT NULL,
  room_number TEXT,
  admission_date INTEGER NOT NULL,
  monthly_rate_kobo INTEGER NOT NULL CHECK(monthly_rate_kobo >= 0),
  payer_ref_id TEXT,
  payer_type TEXT NOT NULL DEFAULT 'family',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_care_residents_tenant ON care_residents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_care_residents_profile ON care_residents(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS care_billing (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  resident_ref_id TEXT NOT NULL,
  billing_period TEXT NOT NULL,
  monthly_charge_kobo INTEGER NOT NULL CHECK(monthly_charge_kobo >= 0),
  paid_kobo INTEGER NOT NULL DEFAULT 0 CHECK(paid_kobo >= 0),
  outstanding_kobo INTEGER NOT NULL DEFAULT 0,
  payment_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_care_billing_tenant ON care_billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_care_billing_profile ON care_billing(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS care_staff_rota (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  role TEXT NOT NULL,
  shift_start INTEGER NOT NULL,
  shift_end INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_care_rota_tenant ON care_staff_rota(tenant_id);
CREATE INDEX IF NOT EXISTS idx_care_rota_profile ON care_staff_rota(profile_id, tenant_id);
