-- Migration 0153: Polling Unit / Electoral District vertical (M12)
-- T3: tenant_id NOT NULL
-- L3 HITL MANDATORY on ALL AI calls — electoral data is most sensitive
-- ABSOLUTE RULE: NO voter PII (names, BVN) stored anywhere
-- All counts INTEGER — registered_voters, accredited_count, votes_cast

CREATE TABLE IF NOT EXISTS polling_unit_profiles (
  id                  TEXT    PRIMARY KEY,
  workspace_id        TEXT    NOT NULL,
  tenant_id           TEXT    NOT NULL,
  org_name            TEXT    NOT NULL, -- LGA INEC office or CSO observer org
  inec_accreditation  TEXT,
  state               TEXT    NOT NULL,
  lga                 TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'seeded',
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_polling_unit_profiles_tenant ON polling_unit_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS polling_units (
  id                TEXT    PRIMARY KEY,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  unit_code         TEXT    NOT NULL UNIQUE,
  ward_name         TEXT    NOT NULL,
  lga               TEXT    NOT NULL,
  state             TEXT    NOT NULL,
  registered_voters INTEGER NOT NULL DEFAULT 0, -- aggregate count only (NO voter PII)
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_polling_units_tenant ON polling_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_polling_units_profile ON polling_units(profile_id);

CREATE TABLE IF NOT EXISTS election_events (
  id                TEXT    PRIMARY KEY,
  unit_id           TEXT    NOT NULL,
  profile_id        TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  election_name     TEXT    NOT NULL,
  election_date     INTEGER NOT NULL,
  accredited_count  INTEGER NOT NULL DEFAULT 0, -- aggregate count (NO voter PII)
  votes_cast        INTEGER NOT NULL DEFAULT 0, -- aggregate count (NO individual result)
  form_ref          TEXT    NOT NULL,           -- INEC EC8A form reference (no raw results)
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_election_events_tenant ON election_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_election_events_unit ON election_events(unit_id);
CREATE INDEX IF NOT EXISTS idx_election_events_profile ON election_events(profile_id);
