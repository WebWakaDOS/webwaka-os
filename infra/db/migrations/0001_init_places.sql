-- Migration: 0001_init_places
-- Description: Create the places table for geography hierarchy.
-- Environment: Applies to both staging and production D1.
-- (TDR-0007, TDR-0011)
--
-- Run:
--   wrangler d1 migrations apply webwaka-os-staging --env staging
--   wrangler d1 migrations apply webwaka-os-production --env production

CREATE TABLE IF NOT EXISTS places (
  id          TEXT NOT NULL PRIMARY KEY,
  name        TEXT NOT NULL,
  geography_type TEXT NOT NULL,
  -- level is derived from geography_type but stored for query performance
  level       INTEGER NOT NULL,
  parent_id   TEXT REFERENCES places(id),
  -- Stored as JSON array of IDs, ordered root → immediate parent.
  -- e.g. '["place_nigeria_001","place_zone_south_west"]'
  ancestry_path TEXT NOT NULL DEFAULT '[]',
  -- NULL for shared geography nodes (states, LGAs, wards).
  -- Populated for tenant-created facility places. (Platform Invariant T3)
  tenant_id   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_places_parent_id ON places(parent_id);
CREATE INDEX IF NOT EXISTS idx_places_geography_type ON places(geography_type);
CREATE INDEX IF NOT EXISTS idx_places_tenant_id ON places(tenant_id)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_places_level ON places(level);
