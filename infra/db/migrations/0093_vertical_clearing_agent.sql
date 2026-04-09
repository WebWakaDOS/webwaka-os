-- Migration: 0093_vertical_clearing_agent.sql
-- Vertical: Clearing & Forwarding Agent (M9, P2/P3)
-- Invariants: P9 (kobo), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS clearing_agent_profiles (
  id                TEXT    PRIMARY KEY,
  workspace_id      TEXT    NOT NULL,
  tenant_id         TEXT    NOT NULL,
  company_name      TEXT    NOT NULL,
  ncs_licence       TEXT,
  nagaff_number     TEXT,
  cac_rc            TEXT,
  status            TEXT    NOT NULL DEFAULT 'seeded',
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_clearing_agent_profiles_tenant   ON clearing_agent_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clearing_agent_profiles_status   ON clearing_agent_profiles(status);
CREATE INDEX IF NOT EXISTS idx_clearing_agent_profiles_workspace ON clearing_agent_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS clearing_shipments (
  id                    TEXT    PRIMARY KEY,
  profile_id            TEXT    NOT NULL,
  tenant_id             TEXT    NOT NULL,
  client_phone          TEXT,
  vessel_name           TEXT,
  bill_of_lading        TEXT,
  container_number      TEXT,
  cargo_description     TEXT,
  declared_value_kobo   INTEGER NOT NULL DEFAULT 0,
  duty_amount_kobo      INTEGER NOT NULL DEFAULT 0,
  vat_kobo              INTEGER NOT NULL DEFAULT 0,
  port_charges_kobo     INTEGER NOT NULL DEFAULT 0,
  professional_fee_kobo INTEGER NOT NULL DEFAULT 0,
  form_m_number         TEXT,
  nafdac_permit_ref     TEXT,
  port                  TEXT    NOT NULL DEFAULT 'apapa',
  status                TEXT    NOT NULL DEFAULT 'lodgement',
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_clearing_shipments_tenant    ON clearing_shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clearing_shipments_status    ON clearing_shipments(status);
CREATE INDEX IF NOT EXISTS idx_clearing_shipments_profile   ON clearing_shipments(profile_id, tenant_id);
