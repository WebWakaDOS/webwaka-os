/**
 * PodcastStudioRepository — M12
 * T3: all queries scoped to tenantId; P9: all monetary in kobo
 * duration_minutes INTEGER; episode_number INTEGER; streams_count INTEGER
 * guest_ref_id and sponsor_ref_id opaque (P13)
 * FSM: seeded → claimed → cac_verified → active → suspended
 */

import type {
  PodcastStudioProfile, PodcastShow, PodcastEpisode, PodcastSession, PodcastSponsorship,
  PodcastStudioFSMState, SessionStatus, SponsorshipStatus,
  CreatePodcastStudioInput, CreatePodcastEpisodeInput, CreatePodcastSessionInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; studio_name: string; nbc_licence: string | null; ncc_registration: string | null; apcon_for_ads: string | null; cac_rc: string | null; status: string; created_at: number; updated_at: number; }
interface ShowRow { id: string; profile_id: string; tenant_id: string; show_name: string; category: string; nbc_reg: string | null; distribution: string | null; created_at: number; updated_at: number; }
interface EpisodeRow { id: string; show_id: string; tenant_id: string; episode_number: number; recording_date: number; duration_minutes: number; release_date: number; streams_count: number; created_at: number; updated_at: number; }
interface SessionRow { id: string; show_id: string; tenant_id: string; guest_ref_id: string; session_date: number; session_fee_kobo: number; status: string; created_at: number; updated_at: number; }
interface SponsorshipRow { id: string; show_id: string; tenant_id: string; episode_id: string; sponsor_ref_id: string; deal_fee_kobo: number; status: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): PodcastStudioProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, studioName: r.studio_name, nbcLicence: r.nbc_licence, nccRegistration: r.ncc_registration, apconForAds: r.apcon_for_ads, cacRc: r.cac_rc, status: r.status as PodcastStudioFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToShow(r: ShowRow): PodcastShow { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, showName: r.show_name, category: r.category, nbcReg: r.nbc_reg, distribution: r.distribution, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToEpisode(r: EpisodeRow): PodcastEpisode { return { id: r.id, showId: r.show_id, tenantId: r.tenant_id, episodeNumber: r.episode_number, recordingDate: r.recording_date, durationMinutes: r.duration_minutes, releaseDate: r.release_date, streamsCount: r.streams_count, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToSession(r: SessionRow): PodcastSession { return { id: r.id, showId: r.show_id, tenantId: r.tenant_id, guestRefId: r.guest_ref_id, sessionDate: r.session_date, sessionFeeKobo: r.session_fee_kobo, status: r.status as SessionStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToSponsorship(r: SponsorshipRow): PodcastSponsorship { return { id: r.id, showId: r.show_id, tenantId: r.tenant_id, episodeId: r.episode_id, sponsorRefId: r.sponsor_ref_id, dealFeeKobo: r.deal_fee_kobo, status: r.status as SponsorshipStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class PodcastStudioRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreatePodcastStudioInput): Promise<PodcastStudioProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO podcast_studio_profiles (id,workspace_id,tenant_id,studio_name,nbc_licence,ncc_registration,apcon_for_ads,cac_rc,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.studioName, input.nbcLicence ?? null, input.nccRegistration ?? null, input.apconForAds ?? null, input.cacRc ?? null, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<PodcastStudioProfile | null> {
    const r = await this.db.prepare('SELECT * FROM podcast_studio_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: PodcastStudioFSMState): Promise<void> {
    await this.db.prepare('UPDATE podcast_studio_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createEpisode(input: CreatePodcastEpisodeInput): Promise<PodcastEpisode> {
    if (!Number.isInteger(input.episodeNumber) || input.episodeNumber <= 0) throw new Error('episodeNumber must be a positive integer');
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) throw new Error('durationMinutes must be a positive integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO podcast_episodes (id,show_id,tenant_id,episode_number,recording_date,duration_minutes,release_date,streams_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,?,?)').bind(id, input.showId, input.tenantId, input.episodeNumber, input.recordingDate, input.durationMinutes, input.releaseDate, ts, ts).run();
    return (await this.findEpisodeById(id, input.tenantId))!;
  }

  async findEpisodeById(id: string, tenantId: string): Promise<PodcastEpisode | null> {
    const r = await this.db.prepare('SELECT * FROM podcast_episodes WHERE id=? AND tenant_id=?').bind(id, tenantId).first<EpisodeRow>();
    return r ? rowToEpisode(r) : null;
  }

  async createSession(input: CreatePodcastSessionInput): Promise<PodcastSession> {
    if (!Number.isInteger(input.sessionFeeKobo) || input.sessionFeeKobo < 0) throw new Error('P9: sessionFeeKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO podcast_sessions (id,show_id,tenant_id,guest_ref_id,session_date,session_fee_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.showId, input.tenantId, input.guestRefId, input.sessionDate, input.sessionFeeKobo, 'booked', ts, ts).run();
    return (await this.findSessionById(id, input.tenantId))!;
  }

  async findSessionById(id: string, tenantId: string): Promise<PodcastSession | null> {
    const r = await this.db.prepare('SELECT * FROM podcast_sessions WHERE id=? AND tenant_id=?').bind(id, tenantId).first<SessionRow>();
    return r ? rowToSession(r) : null;
  }
}
