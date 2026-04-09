/**
 * @webwaka/verticals-political-party
 * Political Party vertical — M8b P1-Original scaffold.
 *
 * Exports:
 *   PoliticalPartyRepository — D1 CRUD for political_party_profiles (T3 isolated)
 *   Types + FSM guards        — Pure functions for state transition validation
 */

export { PoliticalPartyRepository } from './political-party.js';

export type {
  PoliticalPartyProfile,
  PartyFSMState,
  CreatePartyInput,
  UpdatePartyInput,
  PartyFSMGuardResult,
} from './types.js';

export {
  guardPartyClaimToActive,
  isValidPartyTransition,
  VALID_PARTY_TRANSITIONS,
} from './types.js';
