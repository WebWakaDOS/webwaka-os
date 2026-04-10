-- Migration 0181: Negotiable Pricing — Vendor Pricing Policies
-- P9: All monetary values INTEGER kobo. No REAL/FLOAT/NUMERIC/DOUBLE anywhere.
-- Discounts in INTEGER basis points (bps). 100 bps = 1%.
-- T3: tenant_id NOT NULL on every table.
-- One row per workspace. Unique index enforces this.
-- default_pricing_mode: fixed (default) | negotiable | hybrid
-- max_discount_bps default 1500 = 15%. eligible_buyer_kyc_tier default 1 (all KYC levels).

CREATE TABLE IF NOT EXISTS vendor_pricing_policies (
  id                        TEXT    PRIMARY KEY,
  workspace_id              TEXT    NOT NULL REFERENCES workspaces(id),
  tenant_id                 TEXT    NOT NULL,
  default_pricing_mode      TEXT    NOT NULL DEFAULT 'fixed'
                                    CHECK (default_pricing_mode IN ('fixed','negotiable','hybrid')),
  min_price_kobo            INTEGER,
  max_discount_bps          INTEGER NOT NULL DEFAULT 1500,
  max_offer_rounds          INTEGER NOT NULL DEFAULT 3,
  offer_expiry_hours        INTEGER NOT NULL DEFAULT 48,
  auto_accept_threshold_bps INTEGER,
  eligible_buyer_kyc_tier   INTEGER NOT NULL DEFAULT 1,
  wholesale_min_qty         INTEGER,
  created_at                INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at                INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_policy_workspace
  ON vendor_pricing_policies(workspace_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_vendor_policy_tenant
  ON vendor_pricing_policies(tenant_id);
