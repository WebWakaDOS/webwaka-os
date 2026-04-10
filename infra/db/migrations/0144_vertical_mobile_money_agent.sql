-- Migration 0144: Mobile Money Agent vertical (M12)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- Daily cap enforced at route level (default: 30,000,000 kobo = ₦300,000)
-- P13: customer_bvn_ref hashed
-- Tier 3 KYC mandatory

CREATE TABLE IF NOT EXISTS mobile_money_agent_profiles (
  id                        TEXT    PRIMARY KEY,
  workspace_id              TEXT    NOT NULL,
  tenant_id                 TEXT    NOT NULL,
  agent_name                TEXT    NOT NULL,
  cbn_sub_agent_number      TEXT,
  super_agent_provider      TEXT,   -- OPay/Moniepoint/PalmPay/FirstMonie/Kuda
  super_agent_licence_number TEXT,
  cac_or_tin                TEXT,
  status                    TEXT    NOT NULL DEFAULT 'seeded',
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mobile_money_agent_profiles_tenant ON mobile_money_agent_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS mm_float (
  id                  TEXT    PRIMARY KEY,
  agent_id            TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  float_balance_kobo  INTEGER NOT NULL DEFAULT 0,
  daily_used_kobo     INTEGER NOT NULL DEFAULT 0,
  daily_limit_kobo    INTEGER NOT NULL DEFAULT 30000000, -- ₦300,000 sub-agent default
  last_topup_kobo     INTEGER NOT NULL DEFAULT 0,
  last_topup_date     INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mm_float_tenant ON mm_float(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mm_float_agent ON mm_float(agent_id);

CREATE TABLE IF NOT EXISTS mm_transactions (
  id                TEXT    PRIMARY KEY,
  agent_id          TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  transaction_type  TEXT    NOT NULL, -- cash_in/cash_out/transfer/bill/airtime
  amount_kobo       INTEGER NOT NULL,
  commission_kobo   INTEGER NOT NULL,
  customer_bvn_ref  TEXT    NOT NULL, -- hashed (P13)
  reference_number  TEXT    NOT NULL,
  transaction_date  INTEGER NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'completed', -- completed/failed/reversed
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mm_transactions_tenant ON mm_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mm_transactions_agent ON mm_transactions(agent_id);
