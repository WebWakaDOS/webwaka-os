-- Migration 0150: Newspaper Distribution / Media House vertical (M12)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- print_run INTEGER copies; copies_returned INTEGER
-- P13: advertiser_ref_id opaque

CREATE TABLE IF NOT EXISTS newspaper_dist_profiles (
  id                  TEXT    PRIMARY KEY,
  workspace_id        TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  publication_name    TEXT    NOT NULL,
  npc_registration    TEXT,
  npan_membership     TEXT,
  nuj_affiliation     TEXT,
  frequency           TEXT    NOT NULL, -- daily/weekly/monthly
  status              TEXT    NOT NULL DEFAULT 'seeded',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newspaper_dist_profiles_tenant ON newspaper_dist_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS newspaper_print_runs (
  id                   TEXT    PRIMARY KEY,
  profile_id           TEXT    NOT NULL,
  tenant_id            TEXT    NOT NULL,
  edition_date         INTEGER NOT NULL,
  print_run            INTEGER NOT NULL,
  distribution_count   INTEGER NOT NULL DEFAULT 0,
  copies_returned      INTEGER NOT NULL DEFAULT 0,
  cost_per_copy_kobo   INTEGER NOT NULL,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newspaper_print_runs_tenant ON newspaper_print_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_newspaper_print_runs_profile ON newspaper_print_runs(profile_id);

CREATE TABLE IF NOT EXISTS newspaper_vendors (
  id                  TEXT    PRIMARY KEY,
  profile_id          TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  vendor_phone        TEXT    NOT NULL,
  vendor_name         TEXT    NOT NULL,
  credit_limit_kobo   INTEGER NOT NULL DEFAULT 0,
  balance_owing_kobo  INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newspaper_vendors_tenant ON newspaper_vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_newspaper_vendors_profile ON newspaper_vendors(profile_id);

CREATE TABLE IF NOT EXISTS newspaper_ads (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  advertiser_ref_id TEXT    NOT NULL, -- opaque (P13)
  edition_date      INTEGER NOT NULL,
  ad_type           TEXT    NOT NULL, -- front_page/full_page/classifieds
  ad_fee_kobo       INTEGER NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'booked', -- booked/published/invoiced/paid
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newspaper_ads_tenant ON newspaper_ads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_newspaper_ads_profile ON newspaper_ads(profile_id);
