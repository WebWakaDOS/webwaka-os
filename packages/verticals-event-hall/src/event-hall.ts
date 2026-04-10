/**
 * EventHallRepository — M10
 * T3: all queries scoped to tenantId; P9: all monetary in kobo
 * Double-booking prevention: checks for existing booking on same event_date before insert
 * FSM: seeded → claimed → licence_verified → active → suspended
 */

import type {
  EventHallProfile, HallBooking, HallBlockedDate,
  EventHallFSMState, BookingStatus,
  CreateEventHallInput, CreateHallBookingInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; hall_name: string; state_event_licence: string | null; fire_safety_cert: string | null; cac_rc: string | null; capacity_guests: number; status: string; created_at: number; updated_at: number; }
interface BookingRow { id: string; profile_id: string; tenant_id: string; client_phone: string; event_date: number; event_type: string; capacity_required: number; hire_rate_kobo: number; deposit_kobo: number; balance_kobo: number; add_ons: string | null; status: string; created_at: number; updated_at: number; }
interface BlockedRow { id: string; profile_id: string; tenant_id: string; blocked_date: number; reason: string | null; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): EventHallProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, hallName: r.hall_name, stateEventLicence: r.state_event_licence, fireSafetyCert: r.fire_safety_cert, cacRc: r.cac_rc, capacityGuests: r.capacity_guests, status: r.status as EventHallFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToBooking(r: BookingRow): HallBooking { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, clientPhone: r.client_phone, eventDate: r.event_date, eventType: r.event_type, capacityRequired: r.capacity_required, hireRateKobo: r.hire_rate_kobo, depositKobo: r.deposit_kobo, balanceKobo: r.balance_kobo, addOns: r.add_ons, status: r.status as BookingStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToBlocked(r: BlockedRow): HallBlockedDate { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, blockedDate: r.blocked_date, reason: r.reason, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class EventHallRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateEventHallInput): Promise<EventHallProfile> {
    if (!Number.isInteger(input.capacityGuests) || input.capacityGuests < 0) throw new Error('capacityGuests must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO event_hall_profiles (id,workspace_id,tenant_id,hall_name,state_event_licence,fire_safety_cert,cac_rc,capacity_guests,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.hallName, input.stateEventLicence ?? null, input.fireSafetyCert ?? null, input.cacRc ?? null, input.capacityGuests, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<EventHallProfile | null> {
    const r = await this.db.prepare('SELECT * FROM event_hall_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: EventHallFSMState): Promise<void> {
    await this.db.prepare('UPDATE event_hall_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createBooking(input: CreateHallBookingInput): Promise<HallBooking> {
    if (!Number.isInteger(input.hireRateKobo) || input.hireRateKobo < 0) throw new Error('P9: hireRateKobo must be a non-negative integer');
    if (!Number.isInteger(input.depositKobo) || input.depositKobo < 0) throw new Error('P9: depositKobo must be a non-negative integer');
    if (!Number.isInteger(input.capacityRequired) || input.capacityRequired <= 0) throw new Error('capacityRequired must be a positive integer');
    const clash = await this.db.prepare("SELECT id FROM hall_bookings WHERE profile_id=? AND tenant_id=? AND event_date=? AND status NOT IN ('cancelled')").bind(input.profileId, input.tenantId, input.eventDate).first();
    if (clash) throw new Error('Event hall is already booked on this date');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO hall_bookings (id,profile_id,tenant_id,client_phone,event_date,event_type,capacity_required,hire_rate_kobo,deposit_kobo,balance_kobo,add_ons,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.clientPhone, input.eventDate, input.eventType, input.capacityRequired, input.hireRateKobo, input.depositKobo, input.balanceKobo, input.addOns ?? null, 'enquiry', ts, ts).run();
    return (await this.findBookingById(id, input.tenantId))!;
  }

  async findBookingById(id: string, tenantId: string): Promise<HallBooking | null> {
    const r = await this.db.prepare('SELECT * FROM hall_bookings WHERE id=? AND tenant_id=?').bind(id, tenantId).first<BookingRow>();
    return r ? rowToBooking(r) : null;
  }

  async blockDate(profileId: string, tenantId: string, blockedDate: number, reason?: string): Promise<HallBlockedDate> {
    const id = uuid(); const ts = now();
    await this.db.prepare('INSERT INTO hall_blocked_dates (id,profile_id,tenant_id,blocked_date,reason,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id, profileId, tenantId, blockedDate, reason ?? null, ts, ts).run();
    return rowToBlocked((await this.db.prepare('SELECT * FROM hall_blocked_dates WHERE id=?').bind(id).first<BlockedRow>())!);
  }
}
