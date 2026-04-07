-- Seed: Nigeria country root node
-- This is the root of the entire Nigerian geography hierarchy.
-- ancestry_path is empty (no ancestors for the root).

INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id)
VALUES (
  'place_nigeria_001',
  'Nigeria',
  'country',
  1,
  NULL,
  '[]',
  NULL
);
