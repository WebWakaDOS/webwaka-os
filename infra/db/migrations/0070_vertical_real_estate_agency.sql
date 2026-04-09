-- Migration: 0070_vertical_real_estate_agency.sql
-- Vertical: real-estate-agency (M9 Commerce P2 Batch 2)
-- FSM: seeded → claimed → niesv_verified → active → suspended
-- Platform Invariants: P9 (kobo integers), T3 (tenant_id NOT NULL)

CREATE TABLE IF NOT EXISTS real_estate_agency_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  niesv_number TEXT,
  esvarbon_number TEXT,
  cac_number TEXT,
  status TEXT NOT NULL DEFAULT 'seeded',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_real_estate_agency_profiles_tenant ON real_estate_agency_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_agency_profiles_workspace ON real_estate_agency_profiles(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS property_listings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('flat','duplex','bungalow','land','commercial')),
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('sale','rent')),
  state TEXT,
  lga TEXT,
  address TEXT,
  price_kobo INTEGER NOT NULL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','under_offer','let','sold')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_property_listings_workspace ON property_listings(workspace_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_listings_status ON property_listings(status, transaction_type, tenant_id);

CREATE TABLE IF NOT EXISTS property_enquiries (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_name TEXT NOT NULL,
  enquiry_type TEXT NOT NULL CHECK(enquiry_type IN ('viewing','offer','rent')),
  offer_price_kobo INTEGER,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','viewing_scheduled','offer_made','accepted','closed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_property_enquiries_listing ON property_enquiries(listing_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_enquiries_workspace ON property_enquiries(workspace_id, tenant_id);

CREATE TABLE IF NOT EXISTS property_commissions (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('sale','rent')),
  gross_value_kobo INTEGER NOT NULL,
  commission_rate_pct INTEGER NOT NULL,
  commission_kobo INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','invoiced','received')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_property_commissions_listing ON property_commissions(listing_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_commissions_workspace ON property_commissions(workspace_id, tenant_id);
