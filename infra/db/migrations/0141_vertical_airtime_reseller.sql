-- Migration 0141: Airtime / VTU Reseller vertical (M12)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- commission_bps: INTEGER basis points (no floats)
-- CBN sub-agent daily cap: 30,000,000 kobo (₦300,000) enforced at route level
-- P13: recipient_phone only for commission tracking — never exported to AI

CREATE TABLE IF NOT EXISTS airtime_reseller_profiles (
  id                     TEXT    PRIMARY KEY,
  workspace_id           TEXT    NOT NULL,
  tenant_id              TEXT    NOT NULL,
  business_name          TEXT    NOT NULL,
  ncc_dealer_code        TEXT,
  cbn_sub_agent_number   TEXT,
  status                 TEXT    NOT NULL DEFAULT 'seeded',
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_airtime_reseller_profiles_tenant ON airtime_reseller_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS airtime_wallet (
  id                 TEXT    PRIMARY KEY,
  reseller_id        TEXT    NOT NULL,
  tenant_id          TEXT    NOT NULL,
  wallet_balance_kobo INTEGER NOT NULL DEFAULT 0,
  daily_used_kobo    INTEGER NOT NULL DEFAULT 0,
  daily_reset_date   INTEGER NOT NULL,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_airtime_wallet_tenant ON airtime_wallet(tenant_id);
CREATE INDEX IF NOT EXISTS idx_airtime_wallet_reseller ON airtime_wallet(reseller_id);

CREATE TABLE IF NOT EXISTS airtime_transactions (
  id               TEXT    PRIMARY KEY,
  reseller_id      TEXT    NOT NULL,
  tenant_id        TEXT    NOT NULL,
  recipient_phone  TEXT    NOT NULL,
  network          TEXT    NOT NULL, -- MTN/Airtel/Glo/9mobile
  amount_kobo      INTEGER NOT NULL,
  commission_kobo  INTEGER NOT NULL,
  transaction_date INTEGER NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending', -- pending/completed/failed
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_airtime_transactions_tenant ON airtime_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_airtime_transactions_reseller ON airtime_transactions(reseller_id);
