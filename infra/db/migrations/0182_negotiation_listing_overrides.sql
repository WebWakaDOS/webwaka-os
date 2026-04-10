-- Migration 0182: Negotiable Pricing — Listing Price Overrides
-- P9: All monetary values INTEGER kobo. No REAL/FLOAT/NUMERIC/DOUBLE anywhere.
-- Polymorphic: (listing_type, listing_id) references any vertical table row.
-- Unique index enforces one override per listing per tenant.
-- All nullable override fields inherit from vendor_pricing_policies when NULL.

CREATE TABLE IF NOT EXISTS listing_price_overrides (
  id                        TEXT    PRIMARY KEY,
  workspace_id              TEXT    NOT NULL REFERENCES workspaces(id),
  tenant_id                 TEXT    NOT NULL,
  listing_type              TEXT    NOT NULL,
  listing_id                TEXT    NOT NULL,
  pricing_mode              TEXT    NOT NULL
                                    CHECK (pricing_mode IN ('fixed','negotiable','hybrid')),
  listed_price_kobo         INTEGER NOT NULL,
  min_price_kobo            INTEGER,
  max_discount_bps          INTEGER,
  max_offer_rounds          INTEGER,
  offer_expiry_hours        INTEGER,
  auto_accept_threshold_bps INTEGER,
  valid_until               INTEGER,
  created_at                INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at                INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lpo_listing
  ON listing_price_overrides(listing_type, listing_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_lpo_workspace
  ON listing_price_overrides(workspace_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_lpo_tenant
  ON listing_price_overrides(tenant_id);
