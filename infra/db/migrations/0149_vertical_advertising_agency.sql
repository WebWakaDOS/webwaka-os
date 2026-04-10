-- Migration 0149: Advertising Agency vertical (M9)
-- T3: tenant_id NOT NULL; P9: all monetary in kobo integers
-- impressions INTEGER; CPM in kobo INTEGER
-- P13: client_ref_id opaque; creative briefs never to AI

CREATE TABLE IF NOT EXISTS advertising_agency_profiles (
  id                  TEXT    PRIMARY KEY,
  workspace_id        TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  agency_name         TEXT    NOT NULL,
  apcon_registration  TEXT,
  oaan_membership     TEXT,
  cac_rc              TEXT,
  status              TEXT    NOT NULL DEFAULT 'seeded',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_advertising_agency_profiles_tenant ON advertising_agency_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id             TEXT    PRIMARY KEY,
  profile_id     TEXT    NOT NULL,
  tenant_id      TEXT    NOT NULL,
  client_ref_id  TEXT    NOT NULL, -- opaque (P13)
  campaign_name  TEXT    NOT NULL,
  campaign_type  TEXT    NOT NULL, -- digital/OOH/TV/radio/print
  budget_kobo    INTEGER NOT NULL,
  start_date     INTEGER NOT NULL,
  end_date       INTEGER NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'planning', -- planning/active/completed
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_tenant ON ad_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_profile ON ad_campaigns(profile_id);

CREATE TABLE IF NOT EXISTS ad_media_buys (
  id           TEXT    PRIMARY KEY,
  campaign_id  TEXT    NOT NULL,
  tenant_id    TEXT    NOT NULL,
  channel      TEXT    NOT NULL,
  spend_kobo   INTEGER NOT NULL,
  impressions  INTEGER NOT NULL DEFAULT 0,
  cpm_kobo     INTEGER NOT NULL DEFAULT 0, -- cost per 1000 impressions in kobo
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_media_buys_tenant ON ad_media_buys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_media_buys_campaign ON ad_media_buys(campaign_id);

CREATE TABLE IF NOT EXISTS ad_billing (
  id                       TEXT    PRIMARY KEY,
  profile_id               TEXT    NOT NULL,
  tenant_id                TEXT    NOT NULL,
  client_ref_id            TEXT    NOT NULL, -- opaque (P13)
  period                   TEXT    NOT NULL, -- YYYY-MM
  media_spend_kobo         INTEGER NOT NULL,
  agency_commission_kobo   INTEGER NOT NULL,
  retainer_kobo            INTEGER NOT NULL DEFAULT 0,
  total_billed_kobo        INTEGER NOT NULL,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_billing_tenant ON ad_billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_billing_profile ON ad_billing(profile_id);
