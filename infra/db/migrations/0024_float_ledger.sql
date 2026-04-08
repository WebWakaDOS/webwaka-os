-- infra/db/migrations/0024_float_ledger.sql
-- Agent wallets + double-entry float ledger
-- Platform Invariant P9: ALL monetary values are integer kobo. NEVER floating point.
-- M7b: Offline Sync + USSD Gateway + POS Float Ledger

CREATE TABLE IF NOT EXISTS agent_wallets (
  id                TEXT NOT NULL PRIMARY KEY,
  agent_id          TEXT NOT NULL UNIQUE REFERENCES agents(id),
  balance_kobo      INTEGER NOT NULL DEFAULT 0
                    CHECK (balance_kobo >= 0),              -- Cannot go negative
  credit_limit_kobo INTEGER NOT NULL DEFAULT 0
                    CHECK (credit_limit_kobo >= 0),
  tenant_id         TEXT NOT NULL,
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_wallets_agent ON agent_wallets(agent_id);
CREATE INDEX IF NOT EXISTS idx_wallets_tenant ON agent_wallets(tenant_id);

-- Append-only ledger. No UPDATE or DELETE on float_ledger rows ever.
-- Reversals are new rows with negative amount_kobo.
CREATE TABLE IF NOT EXISTS float_ledger (
  id               TEXT NOT NULL PRIMARY KEY,
  wallet_id        TEXT NOT NULL REFERENCES agent_wallets(id),
  amount_kobo      INTEGER NOT NULL,            -- Positive = credit, Negative = debit
  running_balance_kobo INTEGER NOT NULL,        -- Snapshot after this entry
  transaction_type TEXT NOT NULL
                   CHECK (transaction_type IN (
                     'top_up', 'cash_in', 'cash_out', 'commission', 'reversal', 'fee'
                   )),
  reference        TEXT NOT NULL UNIQUE,         -- Idempotency key
  description      TEXT,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON float_ledger(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON float_ledger(reference);
