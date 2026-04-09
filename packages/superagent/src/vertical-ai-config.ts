/**
 * Vertical AI Capability Configuration — SA-2.3
 * WebWaka OS — Per-vertical AI feature declarations.
 *
 * Declares which AICapabilityTypes each P1-Original vertical is permitted
 * to invoke through SuperAgent. This is the source of truth for:
 *   - Displaying which AI features are available in each vertical's UI
 *   - Routing validation before adapter resolution
 *   - Billing category assignment (pillar-tagged usage in ai_usage_events)
 *
 * Platform Invariants:
 *   P7  — No direct SDK calls; all AI goes through @webwaka/ai resolveAdapter
 *   P10 — Consent still required at request time; this config does not waive it
 *   P13 — P13 (PII stripping) is enforced at call site, not here
 */

import type { AICapabilityType } from '@webwaka/ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerticalAiConfig {
  /** Vertical slug (matches verticals.slug in D1) */
  slug: string;
  /** Which pillar owns this vertical's primary operations */
  primaryPillar: 1 | 2 | 3;
  /** AI capabilities permitted for this vertical */
  allowedCapabilities: readonly AICapabilityType[];
  /** Human-readable description of AI use cases for this vertical */
  aiUseCases: string[];
}

// ---------------------------------------------------------------------------
// P1-Original Vertical Configs (17 verticals)
// ---------------------------------------------------------------------------

export const VERTICAL_AI_CONFIGS: Readonly<Record<string, VerticalAiConfig>> = {
  'politician': {
    slug: 'politician',
    primaryPillar: 1,
    allowedCapabilities: [
      'bio_generator',
      'policy_summarizer',
      'sentiment_analysis',
      'content_moderation',
      'translation',
    ],
    aiUseCases: [
      'Auto-generate politician bio from profile data',
      'Summarize policy documents in plain English or Pidgin',
      'Analyse constituent sentiment from community posts',
      'Moderate campaign posts for INEC compliance',
    ],
  },

  'political-party': {
    slug: 'political-party',
    primaryPillar: 1,
    allowedCapabilities: [
      'bio_generator',
      'policy_summarizer',
      'content_moderation',
      'translation',
      'document_extractor',
    ],
    aiUseCases: [
      'Generate party manifesto summaries',
      'Translate party documents to Pidgin or Hausa/Yoruba/Igbo (via translation)',
      'Moderate party forum discussions',
      'Extract key data from INEC submissions',
    ],
  },

  'motor-park': {
    slug: 'motor-park',
    primaryPillar: 1,
    allowedCapabilities: [
      'scheduling_assistant',
      'demand_forecasting',
      'route_optimizer',
      'translation',
    ],
    aiUseCases: [
      'Predict peak departure demand by route and season',
      'Optimise bus allocation across routes',
      'Assist dispatchers with scheduling queries in Pidgin',
    ],
  },

  'mass-transit': {
    slug: 'mass-transit',
    primaryPillar: 1,
    allowedCapabilities: [
      'scheduling_assistant',
      'demand_forecasting',
      'route_optimizer',
      'translation',
    ],
    aiUseCases: [
      'Fleet scheduling and demand forecasting',
      'Route optimisation for BRT/rail corridors',
      'Passenger communication drafting',
    ],
  },

  'rideshare': {
    slug: 'rideshare',
    primaryPillar: 1,
    allowedCapabilities: [
      'scheduling_assistant',
      'route_optimizer',
      'sentiment_analysis',
      'translation',
    ],
    aiUseCases: [
      'Driver-passenger matching optimisation',
      'Ride request demand forecasting',
      'Rider review sentiment analysis for driver ratings',
    ],
  },

  'haulage': {
    slug: 'haulage',
    primaryPillar: 1,
    allowedCapabilities: [
      'route_optimizer',
      'demand_forecasting',
      'scheduling_assistant',
      'document_extractor',
    ],
    aiUseCases: [
      'Long-haul route cost optimisation',
      'Cargo demand forecasting by corridor',
      'Waybill and delivery document extraction',
    ],
  },

  'church': {
    slug: 'church',
    primaryPillar: 2,
    allowedCapabilities: [
      'bio_generator',
      'content_moderation',
      'translation',
      'scheduling_assistant',
    ],
    aiUseCases: [
      'Auto-generate pastor/ministry bios',
      'Moderate church forum and prayer request boards',
      'Translate sermons and devotionals',
      'Event scheduling assistant for church calendar',
    ],
  },

  'mosque': {
    slug: 'mosque',
    primaryPillar: 2,
    allowedCapabilities: [
      'bio_generator',
      'content_moderation',
      'translation',
      'scheduling_assistant',
    ],
    aiUseCases: [
      'Generate Imam and masjid bios',
      'Translate Friday khutbah summaries',
      'Moderate community boards',
      'Salah time scheduling and Ramadan calendar assistant',
    ],
  },

  'school': {
    slug: 'school',
    primaryPillar: 1,
    allowedCapabilities: [
      'bio_generator',
      'document_extractor',
      'content_moderation',
      'scheduling_assistant',
      'translation',
    ],
    aiUseCases: [
      'Auto-generate school profile from registration data',
      'Extract and index school prospectus data',
      'Moderate school notice boards and forums',
      'Timetable scheduling assistant',
    ],
  },

  'hospital': {
    slug: 'hospital',
    primaryPillar: 1,
    allowedCapabilities: [
      'bio_generator',
      'scheduling_assistant',
      'document_extractor',
      'translation',
    ],
    aiUseCases: [
      'Generate doctor/specialist bios from credentials',
      'Patient appointment scheduling assistant',
      'Extract medical service data from PDF tariff sheets',
      'Translate discharge summaries for rural patients',
    ],
  },

  'pharmacy': {
    slug: 'pharmacy',
    primaryPillar: 3,
    allowedCapabilities: [
      'bio_generator',
      'product_description_writer',
      'translation',
      'demand_forecasting',
    ],
    aiUseCases: [
      'Auto-generate pharmacy profile',
      'Write product descriptions for OTC medications',
      'Translate drug information to Pidgin',
      'Forecast medication demand for restocking',
    ],
  },

  'market': {
    slug: 'market',
    primaryPillar: 3,
    allowedCapabilities: [
      'product_description_writer',
      'demand_forecasting',
      'translation',
      'sentiment_analysis',
    ],
    aiUseCases: [
      'Generate product listings for market stall vendors',
      'Demand forecasting for market stock management',
      'Translate product info to Hausa/Yoruba/Igbo/Pidgin',
      'Buyer sentiment from reviews to improve vendor ratings',
    ],
  },

  'pos-business': {
    slug: 'pos-business',
    primaryPillar: 1,
    allowedCapabilities: [
      'demand_forecasting',
      'scheduling_assistant',
      'translation',
      'sentiment_analysis',
    ],
    aiUseCases: [
      'Float demand forecasting by transaction history',
      'Agent scheduling across busy periods',
      'Translate POS receipts and statements to local languages',
      'Analyse agent performance sentiment from customer feedback',
    ],
  },

  'cooperative': {
    slug: 'cooperative',
    primaryPillar: 1,
    allowedCapabilities: [
      'bio_generator',
      'document_extractor',
      'scheduling_assistant',
      'translation',
    ],
    aiUseCases: [
      'Generate cooperative and officers bios',
      'Extract member data from paper registration forms',
      'Meeting and AGM scheduling assistant',
      'Translate cooperative bylaws to Pidgin',
    ],
  },

  'ngo': {
    slug: 'ngo',
    primaryPillar: 1,
    allowedCapabilities: [
      'bio_generator',
      'policy_summarizer',
      'document_extractor',
      'translation',
      'content_moderation',
    ],
    aiUseCases: [
      'Auto-generate NGO and leadership bios',
      'Summarise grant applications and impact reports',
      'Extract data from CAC IT filings',
      'Translate programme materials to local languages',
    ],
  },

  'farm': {
    slug: 'farm',
    primaryPillar: 3,
    allowedCapabilities: [
      'product_description_writer',
      'demand_forecasting',
      'route_optimizer',
      'translation',
    ],
    aiUseCases: [
      'Generate farm produce listings for marketplace',
      'Seasonal harvest demand and price forecasting',
      'Last-mile delivery route optimisation',
      'Translate agro-advisory content to Hausa/Yoruba/Igbo/Pidgin',
    ],
  },

  'artisan': {
    slug: 'artisan',
    primaryPillar: 3,
    allowedCapabilities: [
      'bio_generator',
      'product_description_writer',
      'sentiment_analysis',
      'translation',
    ],
    aiUseCases: [
      'Generate artisan profile and skills bio',
      'Write product descriptions for handcraft listings',
      'Analyse client reviews for service improvement',
      'Translate quotes and invoices to local languages',
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the AI config for a vertical slug.
 * Returns null if the vertical has no AI config declared.
 */
export function getVerticalAiConfig(slug: string): VerticalAiConfig | null {
  return VERTICAL_AI_CONFIGS[slug] ?? null;
}

/**
 * Check if a capability is permitted for a vertical.
 * Returns false for unknown verticals (fail-closed).
 */
export function isCapabilityAllowed(
  slug: string,
  capability: AICapabilityType,
): boolean {
  const config = VERTICAL_AI_CONFIGS[slug];
  if (!config) return false;
  return (config.allowedCapabilities as readonly string[]).includes(capability);
}
