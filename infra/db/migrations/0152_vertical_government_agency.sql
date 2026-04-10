-- Migration 0152: Government Agency / MDA vertical (M11)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- L3 HITL MANDATORY on ALL AI calls — government budget/procurement privilege
-- P13: vendor_ref opaque; procurement details never to AI
-- Tier 3 KYC mandatory

CREATE TABLE IF NOT EXISTS government_agency_profiles (
  id                   TEXT    PRIMARY KEY,
  workspace_id         TEXT    NOT NULL,
  tenant_id            TEXT    NOT NULL,
  agency_name          TEXT    NOT NULL,
  mda_code             TEXT,
  bpp_registration     TEXT,
  tsa_compliance       INTEGER NOT NULL DEFAULT 0, -- BOOLEAN 0/1
  state                TEXT    NOT NULL,
  ministry             TEXT,
  status               TEXT    NOT NULL DEFAULT 'seeded',
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_government_agency_profiles_tenant ON government_agency_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS mda_appropriations (
  id                  TEXT    PRIMARY KEY,
  profile_id          TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  fiscal_year         TEXT    NOT NULL,
  budget_line_item    TEXT    NOT NULL,
  allocated_kobo      INTEGER NOT NULL,
  released_kobo       INTEGER NOT NULL DEFAULT 0,
  spent_kobo          INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mda_appropriations_tenant ON mda_appropriations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mda_appropriations_profile ON mda_appropriations(profile_id);

CREATE TABLE IF NOT EXISTS mda_procurements (
  id                 TEXT    PRIMARY KEY,
  profile_id         TEXT    NOT NULL,
  tenant_id          TEXT    NOT NULL,
  procurement_ref    TEXT    NOT NULL,
  bpp_approval_ref   TEXT,
  vendor_ref         TEXT    NOT NULL, -- opaque (P13)
  amount_kobo        INTEGER NOT NULL,
  category           TEXT    NOT NULL, -- goods/services/works
  status             TEXT    NOT NULL DEFAULT 'open', -- open/evaluated/awarded/completed
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mda_procurements_tenant ON mda_procurements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mda_procurements_profile ON mda_procurements(profile_id);

CREATE TABLE IF NOT EXISTS mda_igr_collections (
  id             TEXT    PRIMARY KEY,
  profile_id     TEXT    NOT NULL,
  tenant_id      TEXT    NOT NULL,
  revenue_type   TEXT    NOT NULL,
  collection_date INTEGER NOT NULL,
  amount_kobo    INTEGER NOT NULL,
  receipt_ref    TEXT    NOT NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mda_igr_collections_tenant ON mda_igr_collections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mda_igr_collections_profile ON mda_igr_collections(profile_id);
