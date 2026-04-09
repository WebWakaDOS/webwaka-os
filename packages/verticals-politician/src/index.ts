/**
 * @webwaka/verticals-politician
 * Individual Politician vertical — M8b P1-Original.
 *
 * Exports:
 *   PoliticianRepository  — D1 CRUD for politician_profiles (T3 isolated)
 *   CampaignRepository    — Donation + volunteer management (T3 isolated)
 *   Types + FSM guards    — Pure functions for state transition validation
 */

export { PoliticianRepository } from './politician.js';
export { CampaignRepository } from './campaign.js';

export type {
  PoliticianProfile,
  PoliticianFSMState,
  OfficeType,
  CreatePoliticianInput,
  UpdatePoliticianInput,
  CampaignDonation,
  CreateDonationInput,
  CampaignStatus,
  FSMGuardResult,
} from './types.js';

export {
  guardSeedToClaimed,
  guardClaimedToCandidate,
  isValidPoliticianTransition,
  VALID_POLITICIAN_TRANSITIONS,
} from './types.js';
