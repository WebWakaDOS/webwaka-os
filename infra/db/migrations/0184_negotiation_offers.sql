-- Migration 0184: Negotiable Pricing — Negotiation Offers
-- P9: amount_kobo is INTEGER NOT NULL CHECK (amount_kobo > 0). No REAL/FLOAT.
-- T3: tenant_id NOT NULL.
-- Immutable offer ledger — each row represents one offer or counteroffer round.
-- responded_at: NULL until buyer/seller responds to this offer.

CREATE TABLE IF NOT EXISTS negotiation_offers (
  id           TEXT    PRIMARY KEY,
  session_id   TEXT    NOT NULL REFERENCES negotiation_sessions(id),
  tenant_id    TEXT    NOT NULL,
  round        INTEGER NOT NULL,
  offered_by   TEXT    NOT NULL CHECK (offered_by IN ('buyer','seller')),
  amount_kobo  INTEGER NOT NULL CHECK (amount_kobo > 0),
  message      TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','accepted','countered','declined','expired')),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  responded_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_neg_offer_session
  ON negotiation_offers(session_id, round);

CREATE INDEX IF NOT EXISTS idx_neg_offer_tenant
  ON negotiation_offers(tenant_id, status);
