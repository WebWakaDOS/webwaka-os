-- Migration 0143: Hire Purchase / Asset Finance vertical (M12)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- installments INTEGER; tenor_months INTEGER (no floats)
-- P13: customer_bvn_ref hashed
-- Tier 3 KYC mandatory

CREATE TABLE IF NOT EXISTS hire_purchase_profiles (
  id                        TEXT    PRIMARY KEY,
  workspace_id              TEXT    NOT NULL,
  tenant_id                 TEXT    NOT NULL,
  company_name              TEXT    NOT NULL,
  cbn_consumer_credit_reg   TEXT,
  cac_rc                    TEXT,
  status                    TEXT    NOT NULL DEFAULT 'seeded',
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hire_purchase_profiles_tenant ON hire_purchase_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS hp_assets (
  id              TEXT    PRIMARY KEY,
  profile_id      TEXT    NOT NULL,
  tenant_id       TEXT    NOT NULL,
  asset_type      TEXT    NOT NULL, -- motorcycle/electronics/agricultural_equipment
  serial_number   TEXT    NOT NULL,
  asset_value_kobo INTEGER NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'available', -- available/on_hp/repossessed
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hp_assets_tenant ON hp_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hp_assets_profile ON hp_assets(profile_id);

CREATE TABLE IF NOT EXISTS hp_agreements (
  id                      TEXT    PRIMARY KEY,
  profile_id              TEXT    NOT NULL,
  tenant_id               TEXT    NOT NULL,
  customer_bvn_ref        TEXT    NOT NULL, -- hashed (P13)
  asset_id                TEXT    NOT NULL,
  total_hp_value_kobo     INTEGER NOT NULL,
  deposit_kobo            INTEGER NOT NULL,
  installments            INTEGER NOT NULL,
  installment_amount_kobo INTEGER NOT NULL,
  tenor_months            INTEGER NOT NULL,
  start_date              INTEGER NOT NULL,
  outstanding_kobo        INTEGER NOT NULL,
  status                  TEXT    NOT NULL DEFAULT 'active', -- active/completed/defaulted/repossessed
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hp_agreements_tenant ON hp_agreements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hp_agreements_profile ON hp_agreements(profile_id);

CREATE TABLE IF NOT EXISTS hp_repayments (
  id                     TEXT    PRIMARY KEY,
  agreement_id           TEXT    NOT NULL,
  tenant_id              TEXT    NOT NULL,
  payment_date           INTEGER NOT NULL,
  amount_kobo            INTEGER NOT NULL,
  outstanding_after_kobo INTEGER NOT NULL,
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hp_repayments_tenant ON hp_repayments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hp_repayments_agreement ON hp_repayments(agreement_id);
