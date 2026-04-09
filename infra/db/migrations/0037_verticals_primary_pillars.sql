-- Migration 0037: Add primary_pillars column to verticals table
-- Purpose: Record which of the three WebWaka platform pillars each vertical serves.
-- Pillar 1 = Operations-Management (POS)
-- Pillar 2 = Branding / Website / Portal
-- Pillar 3 = Listing / Multi-Vendor Marketplace
-- All verticals include at minimum "ops" (Pillar 1). Most also include "marketplace" (Pillar 3).
-- Commerce, professional, creator, and civic verticals typically include "branding" (Pillar 2).
-- Governance: docs/governance/3in1-platform-architecture.md

ALTER TABLE verticals ADD COLUMN primary_pillars TEXT NOT NULL DEFAULT '["ops","marketplace"]';

-- Create index for efficient pillar-based queries
CREATE INDEX IF NOT EXISTS idx_verticals_primary_pillars ON verticals (primary_pillars);

-- Update P1-Original verticals with authoritative pillar classifications
-- (remaining verticals retain default '["ops","marketplace"]' which is correct for most)

UPDATE verticals SET primary_pillars = '["ops","marketplace","branding"]'
WHERE slug IN (
  'politician',
  'political-party',
  'rideshare',
  'haulage',
  'church',
  'ngo',
  'professional',
  'school',
  'clinic',
  'creator',
  'tech-hub'
);

-- pos-business and sole-trader: ops + branding (not primarily marketplace)
UPDATE verticals SET primary_pillars = '["ops","branding"]'
WHERE slug IN (
  'pos-business',
  'sole-trader'
);

-- motor-park, mass-transit, cooperative, market: ops + marketplace (no branded site needed)
UPDATE verticals SET primary_pillars = '["ops","marketplace"]'
WHERE slug IN (
  'motor-park',
  'mass-transit',
  'cooperative',
  'market'
);

-- Commerce verticals with strong branding need
UPDATE verticals SET primary_pillars = '["ops","marketplace","branding"]'
WHERE slug IN (
  'restaurant',
  'supermarket',
  'fashion-brand',
  'pharmacy',
  'beauty-salon',
  'bakery',
  'catering',
  'spa',
  'photography-studio',
  'music-studio',
  'real-estate-agency',
  'hotel',
  'event-hall',
  'travel-agent',
  'law-firm',
  'it-support',
  'handyman',
  'tax-consultant',
  'gym',
  'dental',
  'vet',
  'driving-school',
  'vocational',
  'tutoring',
  'creche',
  'insurance-agent',
  'mobile-money',
  'bdc',
  'hire-purchase',
  'savings-group',
  'wholesale-market',
  'community-hall',
  'warehouse'
);
