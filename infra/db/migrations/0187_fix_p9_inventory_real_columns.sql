-- Migration 0187 — Fix P9 violations: REAL inventory columns → INTEGER ×1000
-- P9: All measurable quantities must be INTEGER to prevent float arithmetic.
-- Convention: quantity × 1000 stored as INTEGER (divide by 1000 for display).

-- bakery_ingredients: convert REAL quantity columns
ALTER TABLE bakery_ingredients RENAME COLUMN quantity_in_stock TO quantity_in_stock_x1000;
ALTER TABLE bakery_ingredients RENAME COLUMN reorder_level TO reorder_level_x1000;

UPDATE bakery_ingredients SET
  quantity_in_stock_x1000 = CAST(ROUND(quantity_in_stock_x1000 * 1000) AS INTEGER),
  reorder_level_x1000     = CAST(ROUND(reorder_level_x1000 * 1000) AS INTEGER);

-- cleaning_supplies: convert REAL quantity column
ALTER TABLE cleaning_supplies RENAME COLUMN quantity_in_stock TO quantity_in_stock_x1000;

UPDATE cleaning_supplies SET
  quantity_in_stock_x1000 = CAST(ROUND(quantity_in_stock_x1000 * 1000) AS INTEGER);
