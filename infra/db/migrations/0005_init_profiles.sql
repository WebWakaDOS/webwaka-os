-- Migration: 0005_init_profiles
-- Description: Create profiles table (discovery records).
-- (claim-first-onboarding.md, Platform Invariant T7)

CREATE TABLE IF NOT EXISTS profiles (
  id                 TEXT NOT NULL PRIMARY KEY,
  -- The entity this profile surfaces for discovery
  subject_type       TEXT NOT NULL CHECK (subject_type IN ('individual', 'organization', 'place')),
  subject_id         TEXT NOT NULL,
  claim_state        TEXT NOT NULL DEFAULT 'seeded'
                     CHECK (claim_state IN (
                       'seeded', 'claimable', 'claim_pending', 'verified',
                       'managed', 'branded', 'monetized', 'delegated'
                     )),
  verification_state TEXT NOT NULL DEFAULT 'unverified',
  publication_state  TEXT NOT NULL DEFAULT 'published',
  -- Primary place for discovery indexing (T6: geography-driven discovery)
  primary_place_id   TEXT REFERENCES places(id),
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_profiles_subject ON profiles(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_profiles_claim_state ON profiles(claim_state);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_place_id ON profiles(primary_place_id);
CREATE INDEX IF NOT EXISTS idx_profiles_publication_state ON profiles(publication_state);