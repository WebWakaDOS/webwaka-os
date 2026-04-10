-- Migration 0183: Negotiable Pricing — Negotiation Sessions
-- P9: All monetary values INTEGER kobo. No REAL/FLOAT/NUMERIC/DOUBLE anywhere.
-- T3: tenant_id NOT NULL.
-- One session per buyer-seller-listing negotiation attempt.
-- final_price_kobo: NULL until status = 'accepted'.
-- Deduplication of open sessions is enforced at application layer, not DB.
-- expires_at index used by CRON expiry sweep (*/15 * * * *).

CREATE TABLE IF NOT EXISTS negotiation_sessions (
  id                  TEXT    PRIMARY KEY,
  tenant_id           TEXT    NOT NULL,
  listing_type        TEXT    NOT NULL,
  listing_id          TEXT    NOT NULL,
  seller_workspace_id TEXT    NOT NULL REFERENCES workspaces(id),
  buyer_ref_id        TEXT    NOT NULL,
  session_type        TEXT    NOT NULL DEFAULT 'offer'
                              CHECK (session_type IN ('offer','bulk_rfq','service_quote')),
  status              TEXT    NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','accepted','declined','expired','cancelled')),
  listed_price_kobo   INTEGER NOT NULL,
  initial_offer_kobo  INTEGER NOT NULL,
  final_price_kobo    INTEGER,
  rounds_used         INTEGER NOT NULL DEFAULT 0,
  max_rounds          INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 1,
  notes               TEXT,
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_neg_session_seller
  ON negotiation_sessions(seller_workspace_id, tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_neg_session_buyer
  ON negotiation_sessions(buyer_ref_id, tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_neg_session_listing
  ON negotiation_sessions(listing_type, listing_id, tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_neg_session_expiry
  ON negotiation_sessions(expires_at, status);
