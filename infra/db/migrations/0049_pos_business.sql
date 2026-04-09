-- Migration 0049: POS Business Management vertical
-- packages/verticals-pos-business (M8b)
-- DISTINCT from packages/pos (agent float infra).
-- T3: tenant_id on all rows; indexed for scoped queries.

CREATE TABLE IF NOT EXISTS pos_products (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  tenant_id    TEXT NOT NULL,
  name         TEXT NOT NULL,
  sku          TEXT,
  price_kobo   INTEGER NOT NULL,  -- P9: integer kobo only
  stock_qty    INTEGER NOT NULL DEFAULT 0,
  category     TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pos_products_tenant   ON pos_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_workspace ON pos_products(workspace_id);

CREATE TABLE IF NOT EXISTS pos_sales (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id),
  tenant_id      TEXT NOT NULL,
  cashier_id     TEXT NOT NULL,  -- user_id of the staff member
  total_kobo     INTEGER NOT NULL,  -- P9: integer kobo only
  payment_method TEXT NOT NULL,     -- cash|card|transfer
  items_json     TEXT NOT NULL,     -- JSON: [{product_id, qty, price_kobo}]
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pos_sales_tenant    ON pos_sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_workspace ON pos_sales(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_cashier   ON pos_sales(cashier_id);

CREATE TABLE IF NOT EXISTS pos_customers (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  tenant_id    TEXT NOT NULL,
  phone        TEXT,
  name         TEXT,
  loyalty_pts  INTEGER NOT NULL DEFAULT 0,  -- P9: integer points only
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pos_customers_tenant    ON pos_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pos_customers_workspace ON pos_customers(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_customers_phone ON pos_customers(tenant_id, phone) WHERE phone IS NOT NULL;
