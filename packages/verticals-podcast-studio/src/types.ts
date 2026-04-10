/**
 * @webwaka/verticals-podcast-studio — types + FSM guards (M12)
 * FSM: seeded → claimed → cac_verified → active → suspended
 * AI: L3 HITL for BROADCAST_SCHEDULING_ASSIST (NBC compliance mandatory);
 *     L2 for sponsorship revenue trend (AD_CAMPAIGN_PERFORMANCE)
 * P9: all monetary values in kobo integers; duration_minutes INTEGER; episode_number INTEGER
 * P13: guest_ref_id and sponsor_ref_id opaque — never to AI
 * T3: all queries scoped to tenant_id
 * KYC: Tier 2 standard; Tier 3 for broadcast licence holders
 */

export type PodcastStudioFSMState =
  | 'seeded'
  | 'claimed'
  | 'cac_verified'
  | 'active'
  | 'suspended';

export type SessionStatus = 'booked' | 'recorded' | 'aired';
export type SponsorshipStatus = 'pending' | 'active' | 'completed';

const FSM_TRANSITIONS: Record<PodcastStudioFSMState, PodcastStudioFSMState[]> = {
  seeded:      ['claimed'],
  claimed:     ['cac_verified'],
  cac_verified: ['active'],
  active:      ['suspended'],
  suspended:   ['active'],
};

export function isValidPodcastStudioTransition(from: PodcastStudioFSMState, to: PodcastStudioFSMState): boolean {
  return FSM_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface GuardResult { allowed: boolean; reason?: string; }

export function guardClaimedToCacVerified(input: { cacRc: string | null }): GuardResult {
  if (!input.cacRc || input.cacRc.trim() === '') {
    return { allowed: false, reason: 'CAC RC required to verify podcast studio' };
  }
  return { allowed: true };
}

export function guardL3HitlRequired(input: { hitlApproved: boolean | undefined }): GuardResult {
  if (!input.hitlApproved) {
    return { allowed: false, reason: 'L3 HITL approval required for podcast broadcast scheduling AI — NBC compliance' };
  }
  return { allowed: true };
}

export function guardL2AiCapSponsorship(input: { autonomyLevel: string | number | undefined }): GuardResult {
  if (input.autonomyLevel === 'L3_HITL' || input.autonomyLevel === 3) {
    return { allowed: false, reason: 'Sponsorship revenue AI capped at L2 advisory — aggregate revenue trend only' };
  }
  if (typeof input.autonomyLevel === 'number' && input.autonomyLevel > 2) {
    return { allowed: false, reason: 'Sponsorship revenue AI capped at L2' };
  }
  return { allowed: true };
}

export function guardNoGuestSponsorInAi(payload: Record<string, unknown>): GuardResult {
  const forbidden = ['guest_ref_id', 'guestRefId', 'sponsor_ref_id', 'sponsorRefId'];
  for (const key of forbidden) {
    if (key in payload) return { allowed: false, reason: `P13: guest/sponsor ref "${key}" must not pass to AI` };
  }
  return { allowed: true };
}

export function guardFractionalKobo(amount: number): GuardResult {
  if (!Number.isInteger(amount) || amount < 0) return { allowed: false, reason: 'P9: kobo must be a non-negative integer' };
  return { allowed: true };
}

export interface PodcastStudioProfile {
  id: string; workspaceId: string; tenantId: string;
  studioName: string; nbcLicence: string | null;
  nccRegistration: string | null; apconForAds: string | null; cacRc: string | null;
  status: PodcastStudioFSMState; createdAt: number; updatedAt: number;
}

export interface PodcastShow {
  id: string; profileId: string; tenantId: string;
  showName: string; category: string; nbcReg: string | null; distribution: string | null;
  createdAt: number; updatedAt: number;
}

export interface PodcastEpisode {
  id: string; showId: string; tenantId: string;
  episodeNumber: number; recordingDate: number; durationMinutes: number;
  releaseDate: number; streamsCount: number;
  createdAt: number; updatedAt: number;
}

export interface PodcastSession {
  id: string; showId: string; tenantId: string;
  guestRefId: string; sessionDate: number; sessionFeeKobo: number;
  status: SessionStatus; createdAt: number; updatedAt: number;
}

export interface PodcastSponsorship {
  id: string; showId: string; tenantId: string;
  episodeId: string; sponsorRefId: string; dealFeeKobo: number;
  status: SponsorshipStatus; createdAt: number; updatedAt: number;
}

export interface CreatePodcastStudioInput {
  id?: string; workspaceId: string; tenantId: string;
  studioName: string; nbcLicence?: string; nccRegistration?: string; apconForAds?: string; cacRc?: string;
}

export interface CreatePodcastEpisodeInput {
  id?: string; showId: string; tenantId: string;
  episodeNumber: number; recordingDate: number; durationMinutes: number; releaseDate: number;
}

export interface CreatePodcastSessionInput {
  id?: string; showId: string; tenantId: string;
  guestRefId: string; sessionDate: number; sessionFeeKobo: number;
}
