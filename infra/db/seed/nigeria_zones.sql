-- Seed: Nigeria's 6 geopolitical zones
-- ancestry_path contains only the Nigeria country ID.

INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id) VALUES
  ('place_zone_north_central', 'North Central', 'geopolitical_zone', 2, 'place_nigeria_001', '["place_nigeria_001"]', NULL),
  ('place_zone_north_east',    'North East',    'geopolitical_zone', 2, 'place_nigeria_001', '["place_nigeria_001"]', NULL),
  ('place_zone_north_west',    'North West',    'geopolitical_zone', 2, 'place_nigeria_001', '["place_nigeria_001"]', NULL),
  ('place_zone_south_east',    'South East',    'geopolitical_zone', 2, 'place_nigeria_001', '["place_nigeria_001"]', NULL),
  ('place_zone_south_south',   'South South',   'geopolitical_zone', 2, 'place_nigeria_001', '["place_nigeria_001"]', NULL),
  ('place_zone_south_west',    'South West',    'geopolitical_zone', 2, 'place_nigeria_001', '["place_nigeria_001"]', NULL);
