/**
 * EventsCentreRepository — M12
 * T3: all queries scoped to tenantId; P9: all monetary in kobo; total_nights INTEGER
 * Section conflict check enforced in createBooking (overlapping dates for same section)
 * FSM: seeded → claimed → licence_verified → active → suspended
 */

import type {
  EventsCentreProfile, EventsCentreSection, EventsCentreBooking,
  EventsCentreFSMState, BookingStatus,
  CreateEventsCentreInput, CreateEventsCentreSectionInput, CreateEventsCentreBookingInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; centre_name: string; state_event_licence: string | null; fire_safety_cert: string | null; lawma_compliance: string | null; cac_rc: string | null; status: string; created_at: number; updated_at: number; }
interface SectionRow { id: string; profile_id: string; tenant_id: string; section_name: string; capacity_guests: number; daily_rate_kobo: number; amenities: string | null; created_at: number; updated_at: number; }
interface BookingRow { id: string; profile_id: string; tenant_id: string; client_phone: string; section_ids: string; event_type: string; start_date: number; end_date: number; total_nights: number; package_kobo: number; deposit_kobo: number; balance_kobo: number; status: string; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): EventsCentreProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, centreName: r.centre_name, stateEventLicence: r.state_event_licence, fireSafetyCert: r.fire_safety_cert, lawmaCompliance: r.lawma_compliance, cacRc: r.cac_rc, status: r.status as EventsCentreFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToSection(r: SectionRow): EventsCentreSection { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, sectionName: r.section_name, capacityGuests: r.capacity_guests, dailyRateKobo: r.daily_rate_kobo, amenities: r.amenities, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToBooking(r: BookingRow): EventsCentreBooking { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, clientPhone: r.client_phone, sectionIds: r.section_ids, eventType: r.event_type, startDate: r.start_date, endDate: r.end_date, totalNights: r.total_nights, packageKobo: r.package_kobo, depositKobo: r.deposit_kobo, balanceKobo: r.balance_kobo, status: r.status as BookingStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class EventsCentreRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateEventsCentreInput): Promise<EventsCentreProfile> {
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO events_centre_profiles (id,workspace_id,tenant_id,centre_name,state_event_licence,fire_safety_cert,lawma_compliance,cac_rc,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.centreName, input.stateEventLicence ?? null, input.fireSafetyCert ?? null, input.lawmaCompliance ?? null, input.cacRc ?? null, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<EventsCentreProfile | null> {
    const r = await this.db.prepare('SELECT * FROM events_centre_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: EventsCentreFSMState): Promise<void> {
    await this.db.prepare('UPDATE events_centre_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createSection(input: CreateEventsCentreSectionInput): Promise<EventsCentreSection> {
    if (!Number.isInteger(input.capacityGuests) || input.capacityGuests < 0) throw new Error('capacityGuests must be a non-negative integer');
    if (!Number.isInteger(input.dailyRateKobo) || input.dailyRateKobo < 0) throw new Error('P9: dailyRateKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO events_centre_sections (id,profile_id,tenant_id,section_name,capacity_guests,daily_rate_kobo,amenities,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.sectionName, input.capacityGuests, input.dailyRateKobo, input.amenities ?? null, ts, ts).run();
    return (await this.findSectionById(id, input.tenantId))!;
  }

  async findSectionById(id: string, tenantId: string): Promise<EventsCentreSection | null> {
    const r = await this.db.prepare('SELECT * FROM events_centre_sections WHERE id=? AND tenant_id=?').bind(id, tenantId).first<SectionRow>();
    return r ? rowToSection(r) : null;
  }

  async createBooking(input: CreateEventsCentreBookingInput): Promise<EventsCentreBooking> {
    if (!Number.isInteger(input.packageKobo) || input.packageKobo < 0) throw new Error('P9: packageKobo must be a non-negative integer');
    if (!Number.isInteger(input.totalNights) || input.totalNights <= 0) throw new Error('totalNights must be a positive integer');
    // Section conflict check for each requested section
    for (const sectionId of input.sectionIds) {
      const clash = await this.db.prepare("SELECT id FROM events_centre_bookings WHERE profile_id=? AND tenant_id=? AND status NOT IN ('cancelled') AND section_ids LIKE ? AND NOT (end_date <= ? OR start_date >= ?)").bind(input.profileId, input.tenantId, `%${sectionId}%`, input.startDate, input.endDate).first();
      if (clash) throw new Error(`Section "${sectionId}" has an overlapping booking for the requested dates`);
    }
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO events_centre_bookings (id,profile_id,tenant_id,client_phone,section_ids,event_type,start_date,end_date,total_nights,package_kobo,deposit_kobo,balance_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.clientPhone, JSON.stringify(input.sectionIds), input.eventType, input.startDate, input.endDate, input.totalNights, input.packageKobo, input.depositKobo, input.balanceKobo, 'enquiry', ts, ts).run();
    return (await this.findBookingById(id, input.tenantId))!;
  }

  async findBookingById(id: string, tenantId: string): Promise<EventsCentreBooking | null> {
    const r = await this.db.prepare('SELECT * FROM events_centre_bookings WHERE id=? AND tenant_id=?').bind(id, tenantId).first<BookingRow>();
    return r ? rowToBooking(r) : null;
  }
}
