-- Migration 0116 — Rehabilitation / Recovery Centre vertical (M12)
-- Platform Invariants: T3 (tenant_id NOT NULL), P9 (monetary in kobo)
-- P13: resident_ref_id opaque UUID — no name, condition, substance, diagnosis EVER in D1
-- L3 HITL mandatory for ALL SuperAgent calls from this vertical

CREATE TABLE IF NOT EXISTS rehab_centre_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  centre_name TEXT NOT NULL,
  ndlea_licence TEXT,
  fmhsw_registration TEXT,
  cac_rc TEXT,
  bed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_rehab_profiles_tenant ON rehab_centre_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rehab_profiles_workspace ON rehab_centre_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS rehab_programmes (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  programme_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK(duration_days > 0),
  total_fee_kobo INTEGER NOT NULL CHECK(total_fee_kobo >= 0),
  programme_type TEXT NOT NULL DEFAULT 'residential',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_rehab_programmes_tenant ON rehab_programmes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rehab_programmes_profile ON rehab_programmes(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS rehab_enrolments (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  resident_ref_id TEXT NOT NULL,
  programme_id TEXT NOT NULL,
  enrolment_date INTEGER NOT NULL,
  deposit_kobo INTEGER NOT NULL DEFAULT 0 CHECK(deposit_kobo >= 0),
  balance_kobo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_rehab_enrolments_tenant ON rehab_enrolments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rehab_enrolments_profile ON rehab_enrolments(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS rehab_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  resident_ref_id TEXT NOT NULL,
  session_date INTEGER NOT NULL,
  facilitator_id TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'group',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_rehab_sessions_tenant ON rehab_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rehab_sessions_profile ON rehab_sessions(profile_id, tenant_id);
