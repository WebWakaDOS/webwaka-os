-- Migration 0146: Water Treatment / Borehole Operator vertical (M11)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- Scaled integers: ph_x100 (pH × 100), chlorine_ppm10 (ppm × 10), turbidity_ntu10 (NTU × 10)
-- Volume in integer litres; capacity in integer litres/day

CREATE TABLE IF NOT EXISTS water_treatment_profiles (
  id                        TEXT    PRIMARY KEY,
  workspace_id              TEXT    NOT NULL,
  tenant_id                 TEXT    NOT NULL,
  company_name              TEXT    NOT NULL,
  nafdac_water_licence      TEXT,
  state_water_board_cert    TEXT,
  cac_rc                    TEXT,
  capacity_litres_per_day   INTEGER NOT NULL DEFAULT 0,
  status                    TEXT    NOT NULL DEFAULT 'seeded',
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_treatment_profiles_tenant ON water_treatment_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS water_quality_log (
  id               TEXT    PRIMARY KEY,
  profile_id       TEXT    NOT NULL,
  tenant_id        TEXT    NOT NULL,
  test_date        INTEGER NOT NULL,
  ph_x100          INTEGER NOT NULL, -- pH × 100 (e.g., 720 = pH 7.20)
  chlorine_ppm10   INTEGER NOT NULL, -- ppm × 10 (e.g., 5 = 0.5 ppm)
  turbidity_ntu10  INTEGER NOT NULL, -- NTU × 10
  passed_standards INTEGER NOT NULL DEFAULT 0, -- BOOLEAN as 0/1
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_quality_log_tenant ON water_quality_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_water_quality_log_profile ON water_quality_log(profile_id);

CREATE TABLE IF NOT EXISTS water_subscriptions (
  id                      TEXT    PRIMARY KEY,
  profile_id              TEXT    NOT NULL,
  tenant_id               TEXT    NOT NULL,
  client_phone            TEXT    NOT NULL,
  property_type           TEXT    NOT NULL, -- residential/commercial/estate
  monthly_rate_kobo       INTEGER NOT NULL,
  daily_litres_allocation INTEGER NOT NULL,
  payment_status          TEXT    NOT NULL DEFAULT 'active', -- active/suspended/cancelled
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_subscriptions_tenant ON water_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_water_subscriptions_profile ON water_subscriptions(profile_id);

CREATE TABLE IF NOT EXISTS water_billing (
  id                      TEXT    PRIMARY KEY,
  subscription_id         TEXT    NOT NULL,
  tenant_id               TEXT    NOT NULL,
  client_phone            TEXT    NOT NULL,
  billing_month           TEXT    NOT NULL, -- YYYY-MM
  volume_supplied_litres  INTEGER NOT NULL,
  billed_kobo             INTEGER NOT NULL,
  paid_kobo               INTEGER NOT NULL DEFAULT 0,
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_billing_tenant ON water_billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_water_billing_subscription ON water_billing(subscription_id);
