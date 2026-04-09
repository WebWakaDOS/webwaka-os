-- Migration 0111 — Dental Clinic / Orthodontist vertical (M9)
-- Platform Invariants: T3 (tenant_id NOT NULL), P9 (monetary in kobo)
-- P13: patient_ref_id is opaque UUID — patient name never stored in primary tables

CREATE TABLE IF NOT EXISTS dental_clinic_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  mdcn_facility_reg TEXT,
  adsn_membership TEXT,
  cac_rc TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dental_profiles_tenant ON dental_clinic_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dental_profiles_workspace ON dental_clinic_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS dental_dentists (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  dentist_ref_id TEXT NOT NULL,
  mdcn_reg_number TEXT NOT NULL,
  specialisation TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dental_dentists_tenant ON dental_dentists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dental_dentists_profile ON dental_dentists(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS dental_appointments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  patient_ref_id TEXT NOT NULL,
  dentist_ref_id TEXT NOT NULL,
  appointment_time INTEGER NOT NULL,
  treatment_type TEXT NOT NULL DEFAULT 'consultation',
  consultation_fee_kobo INTEGER NOT NULL CHECK(consultation_fee_kobo >= 0),
  status TEXT NOT NULL DEFAULT 'booked',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dental_appts_tenant ON dental_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dental_appts_profile ON dental_appointments(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS dental_treatments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  treatment_cost_kobo INTEGER NOT NULL CHECK(treatment_cost_kobo >= 0),
  lab_ref TEXT,
  notes_ref TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dental_treatments_tenant ON dental_treatments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dental_treatments_profile ON dental_treatments(profile_id, tenant_id);
