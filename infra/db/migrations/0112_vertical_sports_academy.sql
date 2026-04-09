-- Migration 0112 — Sports Academy / Fitness Centre vertical (M10)
-- Platform Invariants: T3 (tenant_id NOT NULL), P9 (monetary in kobo)
-- P13: member_ref_id opaque — health metrics never stored for AI

CREATE TABLE IF NOT EXISTS sports_academy_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  academy_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'gym',
  state_sports_permit TEXT,
  cac_rc TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sports_academy_tenant ON sports_academy_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sports_academy_workspace ON sports_academy_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS sports_members (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  member_ref_id TEXT NOT NULL,
  membership_plan TEXT NOT NULL DEFAULT 'monthly',
  plan_fee_kobo INTEGER NOT NULL CHECK(plan_fee_kobo >= 0),
  valid_until INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sports_members_tenant ON sports_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sports_members_profile ON sports_members(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS sports_classes (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  trainer_id TEXT,
  schedule_day TEXT,
  schedule_time TEXT,
  capacity INTEGER DEFAULT 20,
  enrolled_count INTEGER DEFAULT 0,
  class_fee_kobo INTEGER NOT NULL DEFAULT 0 CHECK(class_fee_kobo >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sports_classes_tenant ON sports_classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sports_classes_profile ON sports_classes(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS sports_checkins (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  member_ref_id TEXT NOT NULL,
  class_id TEXT,
  check_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sports_checkins_tenant ON sports_checkins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sports_checkins_profile ON sports_checkins(profile_id, tenant_id);

CREATE TABLE IF NOT EXISTS sports_equipment (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_cost_kobo INTEGER NOT NULL DEFAULT 0 CHECK(purchase_cost_kobo >= 0),
  last_service_date INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sports_equipment_tenant ON sports_equipment(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sports_equipment_profile ON sports_equipment(profile_id, tenant_id);
