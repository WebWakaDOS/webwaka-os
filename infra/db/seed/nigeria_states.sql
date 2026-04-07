-- Seed: Nigeria's 36 states + FCT
-- Grouped by geopolitical zone.
-- ancestry_path format: ["place_nigeria_001", "<zone_id>"]

-- North Central (6 states + FCT)
INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id) VALUES
  ('place_state_benue',   'Benue',                'state', 3, 'place_zone_north_central', '["place_nigeria_001","place_zone_north_central"]', NULL),
  ('place_state_kogi',    'Kogi',                 'state', 3, 'place_zone_north_central', '["place_nigeria_001","place_zone_north_central"]', NULL),
  ('place_state_kwara',   'Kwara',                'state', 3, 'place_zone_north_central', '["place_nigeria_001","place_zone_north_central"]', NULL),
  ('place_state_nasarawa','Nasarawa',             'state', 3, 'place_zone_north_central', '["place_nigeria_001","place_zone_north_central"]', NULL),
  ('place_state_niger',   'Niger',                'state', 3, 'place_zone_north_central', '["place_nigeria_001","place_zone_north_central"]', NULL),
  ('place_state_plateau', 'Plateau',              'state', 3, 'place_zone_north_central', '["place_nigeria_001","place_zone_north_central"]', NULL),
  ('place_state_fct',     'Federal Capital Territory', 'state', 3, 'place_zone_north_central', '["place_nigeria_001","place_zone_north_central"]', NULL);

-- North East (6 states)
INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id) VALUES
  ('place_state_adamawa', 'Adamawa', 'state', 3, 'place_zone_north_east', '["place_nigeria_001","place_zone_north_east"]', NULL),
  ('place_state_bauchi',  'Bauchi',  'state', 3, 'place_zone_north_east', '["place_nigeria_001","place_zone_north_east"]', NULL),
  ('place_state_borno',   'Borno',   'state', 3, 'place_zone_north_east', '["place_nigeria_001","place_zone_north_east"]', NULL),
  ('place_state_gombe',   'Gombe',   'state', 3, 'place_zone_north_east', '["place_nigeria_001","place_zone_north_east"]', NULL),
  ('place_state_taraba',  'Taraba',  'state', 3, 'place_zone_north_east', '["place_nigeria_001","place_zone_north_east"]', NULL),
  ('place_state_yobe',    'Yobe',    'state', 3, 'place_zone_north_east', '["place_nigeria_001","place_zone_north_east"]', NULL);

-- North West (7 states)
INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id) VALUES
  ('place_state_jigawa',  'Jigawa',  'state', 3, 'place_zone_north_west', '["place_nigeria_001","place_zone_north_west"]', NULL),
  ('place_state_kaduna',  'Kaduna',  'state', 3, 'place_zone_north_west', '["place_nigeria_001","place_zone_north_west"]', NULL),
  ('place_state_kano',    'Kano',    'state', 3, 'place_zone_north_west', '["place_nigeria_001","place_zone_north_west"]', NULL),
  ('place_state_katsina', 'Katsina', 'state', 3, 'place_zone_north_west', '["place_nigeria_001","place_zone_north_west"]', NULL),
  ('place_state_kebbi',   'Kebbi',   'state', 3, 'place_zone_north_west', '["place_nigeria_001","place_zone_north_west"]', NULL),
  ('place_state_sokoto',  'Sokoto',  'state', 3, 'place_zone_north_west', '["place_nigeria_001","place_zone_north_west"]', NULL),
  ('place_state_zamfara', 'Zamfara', 'state', 3, 'place_zone_north_west', '["place_nigeria_001","place_zone_north_west"]', NULL);

-- South East (5 states)
INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id) VALUES
  ('place_state_abia',     'Abia',     'state', 3, 'place_zone_south_east', '["place_nigeria_001","place_zone_south_east"]', NULL),
  ('place_state_anambra',  'Anambra',  'state', 3, 'place_zone_south_east', '["place_nigeria_001","place_zone_south_east"]', NULL),
  ('place_state_ebonyi',   'Ebonyi',   'state', 3, 'place_zone_south_east', '["place_nigeria_001","place_zone_south_east"]', NULL),
  ('place_state_enugu',    'Enugu',    'state', 3, 'place_zone_south_east', '["place_nigeria_001","place_zone_south_east"]', NULL),
  ('place_state_imo',      'Imo',      'state', 3, 'place_zone_south_east', '["place_nigeria_001","place_zone_south_east"]', NULL);

-- South South (6 states)
INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id) VALUES
  ('place_state_akwaibom', 'Akwa Ibom',     'state', 3, 'place_zone_south_south', '["place_nigeria_001","place_zone_south_south"]', NULL),
  ('place_state_bayelsa',  'Bayelsa',       'state', 3, 'place_zone_south_south', '["place_nigeria_001","place_zone_south_south"]', NULL),
  ('place_state_crossriver','Cross River',  'state', 3, 'place_zone_south_south', '["place_nigeria_001","place_zone_south_south"]', NULL),
  ('place_state_delta',    'Delta',         'state', 3, 'place_zone_south_south', '["place_nigeria_001","place_zone_south_south"]', NULL),
  ('place_state_edo',      'Edo',           'state', 3, 'place_zone_south_south', '["place_nigeria_001","place_zone_south_south"]', NULL),
  ('place_state_rivers',   'Rivers',        'state', 3, 'place_zone_south_south', '["place_nigeria_001","place_zone_south_south"]', NULL);

-- South West (6 states)
INSERT OR IGNORE INTO places (id, name, geography_type, level, parent_id, ancestry_path, tenant_id) VALUES
  ('place_state_ekiti',    'Ekiti',    'state', 3, 'place_zone_south_west', '["place_nigeria_001","place_zone_south_west"]', NULL),
  ('place_state_lagos',    'Lagos',    'state', 3, 'place_zone_south_west', '["place_nigeria_001","place_zone_south_west"]', NULL),
  ('place_state_ogun',     'Ogun',     'state', 3, 'place_zone_south_west', '["place_nigeria_001","place_zone_south_west"]', NULL),
  ('place_state_ondo',     'Ondo',     'state', 3, 'place_zone_south_west', '["place_nigeria_001","place_zone_south_west"]', NULL),
  ('place_state_osun',     'Osun',     'state', 3, 'place_zone_south_west', '["place_nigeria_001","place_zone_south_west"]', NULL),
  ('place_state_oyo',      'Oyo',      'state', 3, 'place_zone_south_west', '["place_nigeria_001","place_zone_south_west"]', NULL);
