-- Migration 0142: Bureau de Change / FX Dealer vertical (M12)
-- T3: tenant_id NOT NULL; P9: naira amounts in kobo integers
-- FX rates stored as integer kobo per USD cent (NEVER float rates)
-- USD amounts stored as integer cents (NEVER floats)
-- P13: customer_bvn_ref hashed; EFCC flag stored
-- Tier 3 KYC mandatory

CREATE TABLE IF NOT EXISTS bdc_profiles (
  id                   TEXT    PRIMARY KEY,
  workspace_id         TEXT    NOT NULL,
  tenant_id            TEXT    NOT NULL,
  company_name         TEXT    NOT NULL,
  cbn_bdc_licence      TEXT,
  abcon_membership     TEXT,
  cbn_tier             INTEGER,            -- 1 or 2
  cac_rc               TEXT,
  status               TEXT    NOT NULL DEFAULT 'seeded',
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bdc_profiles_tenant ON bdc_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS bdc_rates (
  id                       TEXT    PRIMARY KEY,
  profile_id               TEXT    NOT NULL,
  tenant_id                TEXT    NOT NULL,
  rate_date                INTEGER NOT NULL,
  currency                 TEXT    NOT NULL, -- USD/EUR/GBP/CNY
  buy_rate_kobo_per_cent   INTEGER NOT NULL, -- kobo per USD cent (no floats)
  sell_rate_kobo_per_cent  INTEGER NOT NULL,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bdc_rates_tenant ON bdc_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bdc_rates_profile ON bdc_rates(profile_id);

CREATE TABLE IF NOT EXISTS bdc_transactions (
  id                     TEXT    PRIMARY KEY,
  profile_id             TEXT    NOT NULL,
  tenant_id              TEXT    NOT NULL,
  customer_bvn_ref       TEXT    NOT NULL, -- hashed BVN reference (P13)
  currency               TEXT    NOT NULL,
  usd_amount_cents       INTEGER NOT NULL, -- USD cents (no floats)
  naira_amount_kobo      INTEGER NOT NULL,
  direction              TEXT    NOT NULL, -- buy/sell
  transaction_date       INTEGER NOT NULL,
  efcc_report_required   INTEGER NOT NULL DEFAULT 0, -- BOOLEAN as 0/1
  status                 TEXT    NOT NULL DEFAULT 'completed', -- completed/reversed
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bdc_transactions_tenant ON bdc_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bdc_transactions_profile ON bdc_transactions(profile_id);
