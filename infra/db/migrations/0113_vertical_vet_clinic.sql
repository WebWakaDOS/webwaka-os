-- Migration 0113 — Veterinary Clinic / Pet Shop vertical (M10)
-- Platform Invariants: T3 (tenant_id NOT NULL), P9 (monetary in kobo)
-- P13: animal_ref_id and owner_ref_id opaque UUIDs — no clinical diagnosis stored

CREATE TABLE IF NOT EXISTS vet_clinic_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  vcnb_registration TEXT,
  cac_rc TEXT,
  clinic_type TEXT NOT NULL DEFAULT 'companion',
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_vet_profiles_tenant ON vet_clinic_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vet_profiles_workspace ON vet_clinic_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS vet_patients (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  animal_ref_id TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  owner_ref_id TEXT NOT NULL,
  age_months INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_vet_patients_tenant ON vet_patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vet_patients_profile ON vet_patients(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS vet_appointments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  animal_ref_id TEXT NOT NULL,
  vet_id TEXT NOT NULL,
  appointment_time INTEGER NOT NULL,
  appointment_type TEXT NOT NULL DEFAULT 'consultation',
  consultation_fee_kobo INTEGER NOT NULL CHECK(consultation_fee_kobo >= 0),
  status TEXT NOT NULL DEFAULT 'booked',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_vet_appts_tenant ON vet_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vet_appts_profile ON vet_appointments(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS vet_vaccinations (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  animal_ref_id TEXT NOT NULL,
  vaccine_name TEXT NOT NULL,
  date_administered INTEGER NOT NULL,
  next_due INTEGER,
  cost_kobo INTEGER NOT NULL CHECK(cost_kobo >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_vet_vaccinations_tenant ON vet_vaccinations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vet_vaccinations_profile ON vet_vaccinations(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS vet_shop_inventory (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'food',
  unit_price_kobo INTEGER NOT NULL CHECK(unit_price_kobo >= 0),
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_vet_shop_tenant ON vet_shop_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vet_shop_profile ON vet_shop_inventory(profile_id, tenant_id);
