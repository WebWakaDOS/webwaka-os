-- Migration: 0006_init_political
-- Description: Create jurisdictions, terms, political assignments, and party affiliations.
-- (political-taxonomy.md, TDR-0011)

-- Jurisdictions: specific territory instances (linked to places)
CREATE TABLE IF NOT EXISTS jurisdictions (
  id             TEXT NOT NULL PRIMARY KEY,
  place_id       TEXT NOT NULL REFERENCES places(id),
  territory_type TEXT NOT NULL,
  name           TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (place_id, territory_type)
);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_place_id ON jurisdictions(place_id);
CREATE INDEX IF NOT EXISTS idx_jurisdictions_territory_type ON jurisdictions(territory_type);

-- Term records: start/end windows for political assignments
CREATE TABLE IF NOT EXISTS terms (
  id           TEXT NOT NULL PRIMARY KEY,
  start_date   TEXT NOT NULL,
  end_date     TEXT,
  confirmed_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Political assignments: person holding office over jurisdiction
CREATE TABLE IF NOT EXISTS political_assignments (
  id                 TEXT NOT NULL PRIMARY KEY,
  individual_id      TEXT NOT NULL REFERENCES individuals(id),
  office_type        TEXT NOT NULL,
  jurisdiction_id    TEXT NOT NULL REFERENCES jurisdictions(id),
  term_id            TEXT NOT NULL REFERENCES terms(id),
  verification_state TEXT NOT NULL DEFAULT 'unverified',
  tenant_id          TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_political_assignments_individual_id ON political_assignments(individual_id);
CREATE INDEX IF NOT EXISTS idx_political_assignments_jurisdiction_id ON political_assignments(jurisdiction_id);
CREATE INDEX IF NOT EXISTS idx_political_assignments_office_type ON political_assignments(office_type);
CREATE INDEX IF NOT EXISTS idx_political_assignments_tenant_id ON political_assignments(tenant_id);

-- Party affiliations: individual ↔ political party (organization)
CREATE TABLE IF NOT EXISTS party_affiliations (
  id                TEXT NOT NULL PRIMARY KEY,
  individual_id     TEXT NOT NULL REFERENCES individuals(id),
  party_id          TEXT NOT NULL REFERENCES organizations(id),
  membership_number TEXT,
  joined_at         TEXT,
  left_at           TEXT,
  is_primary        INTEGER NOT NULL DEFAULT 1, -- SQLite boolean
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_party_affiliations_individual_id ON party_affiliations(individual_id);
CREATE INDEX IF NOT EXISTS idx_party_affiliations_party_id ON party_affiliations(party_id);

-- Candidate records: pre-election
CREATE TABLE IF NOT EXISTS candidate_records (
  individual_id       TEXT NOT NULL REFERENCES individuals(id),
  office_type         TEXT NOT NULL,
  jurisdiction_id     TEXT NOT NULL REFERENCES jurisdictions(id),
  party_affiliation_id TEXT REFERENCES party_affiliations(id),
  election_date       TEXT NOT NULL,
  verification_state  TEXT NOT NULL DEFAULT 'unverified',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (individual_id, office_type, jurisdiction_id, election_date)
);
