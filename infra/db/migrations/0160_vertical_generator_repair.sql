-- Migration 0160: Generator Repair / HVAC Technician vertical (M10)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- P13: customer_ref_id opaque

CREATE TABLE IF NOT EXISTS generator_repair_profiles (
  id                  TEXT    PRIMARY KEY,
  workspace_id        TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  business_name       TEXT    NOT NULL,
  cac_rc              TEXT,
  son_cert            TEXT,
  coren_awareness     TEXT,
  service_type        TEXT    NOT NULL DEFAULT 'generator', -- generator/hvac/mixed
  status              TEXT    NOT NULL DEFAULT 'seeded',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generator_repair_profiles_tenant ON generator_repair_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_generator_repair_profiles_workspace ON generator_repair_profiles(workspace_id);

CREATE TABLE IF NOT EXISTS generator_repair_jobs (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  customer_ref_id   TEXT    NOT NULL, -- opaque (P13)
  equipment_type    TEXT    NOT NULL, -- generator/ac/freezer/pump/hvac
  brand             TEXT,
  serial_number     TEXT,
  fault_category    TEXT,
  parts_used        TEXT, -- JSON array
  labour_cost_kobo  INTEGER NOT NULL DEFAULT 0,
  parts_cost_kobo   INTEGER NOT NULL DEFAULT 0,
  total_cost_kobo   INTEGER NOT NULL DEFAULT 0,
  job_date          INTEGER NOT NULL,
  completed_date    INTEGER,
  warranty_days     INTEGER NOT NULL DEFAULT 0,
  status            TEXT    NOT NULL DEFAULT 'logged', -- logged/diagnosed/in_repair/completed/warranty_claim
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generator_repair_jobs_tenant ON generator_repair_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_generator_repair_jobs_profile ON generator_repair_jobs(profile_id);

CREATE TABLE IF NOT EXISTS generator_repair_parts (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  part_name         TEXT    NOT NULL,
  brand_compatible  TEXT,
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  unit_cost_kobo    INTEGER NOT NULL DEFAULT 0,
  reorder_level     INTEGER NOT NULL DEFAULT 3,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generator_repair_parts_tenant ON generator_repair_parts(tenant_id);
