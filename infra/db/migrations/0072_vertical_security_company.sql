-- Migration: 0072_vertical_security_company.sql
-- Vertical: security-company (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → psc_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)
-- P13: Guard PII (names, ID numbers) stored in platform only — never sent to AI

CREATE TABLE IF NOT EXISTS security_company_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  psc_licence TEXT,
  pscai_number TEXT,
  cac_rc TEXT,
  guard_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_security_company_profiles_tenant ON security_company_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_company_profiles_workspace ON security_company_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS security_guards (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  guard_name TEXT NOT NULL,
  id_number TEXT,
  training_cert TEXT,
  deployment_site_id TEXT,
  monthly_salary_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','terminated')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_security_guards_workspace ON security_guards(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_guards_site ON security_guards(deployment_site_id, tenant_id);

CREATE TABLE IF NOT EXISTS security_sites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  client_phone TEXT,
  address TEXT,
  state TEXT,
  guard_count_required INTEGER NOT NULL DEFAULT 1,
  monthly_fee_kobo INTEGER NOT NULL,
  contract_start INTEGER,
  contract_end INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_security_sites_workspace ON security_sites(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS security_incidents (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  report_date INTEGER NOT NULL,
  incident_type TEXT NOT NULL,
  description TEXT,
  guard_id TEXT,
  action_taken TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_site ON security_incidents(site_id, tenant_id);
