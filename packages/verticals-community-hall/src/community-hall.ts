/**
 * CommunityHallRepository — M12
 * T3: all queries scoped to tenantId; P9: all monetary in kobo
 * 3-state FSM: seeded → claimed → active
 * Double-booking prevention enforced in createBooking
 */

import type {
  CommunityHallProfile, CommunityHallBooking, CommunityHallMaintenance,
  CommunityHallFSMState, BookingStatus,
  CreateCommunityHallInput, CreateCommunityHallBookingInput, CreateCommunityHallMaintenanceInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }
function uuid() { return crypto.randomUUID(); }
function now() { return Math.floor(Date.now() / 1000); }

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; hall_name: string; cda_registration: string | null; lga: string; state: string; capacity_seats: number; status: string; created_at: number; updated_at: number; }
interface BookingRow { id: string; profile_id: string; tenant_id: string; group_name: string; event_type: string; booking_date: number; hire_fee_kobo: number; deposit_kobo: number; status: string; created_at: number; updated_at: number; }
interface MaintenanceRow { id: string; profile_id: string; tenant_id: string; contribution_date: number; contributor_ref: string; amount_kobo: number; purpose: string | null; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): CommunityHallProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, hallName: r.hall_name, cdaRegistration: r.cda_registration, lga: r.lga, state: r.state, capacitySeats: r.capacity_seats, status: r.status as CommunityHallFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToBooking(r: BookingRow): CommunityHallBooking { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, groupName: r.group_name, eventType: r.event_type, bookingDate: r.booking_date, hireFeeKobo: r.hire_fee_kobo, depositKobo: r.deposit_kobo, status: r.status as BookingStatus, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToMaintenance(r: MaintenanceRow): CommunityHallMaintenance { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, contributionDate: r.contribution_date, contributorRef: r.contributor_ref, amountKobo: r.amount_kobo, purpose: r.purpose, createdAt: r.created_at, updatedAt: r.updated_at }; }

export class CommunityHallRepository {
  constructor(private db: D1Like) {}

  async createProfile(input: CreateCommunityHallInput): Promise<CommunityHallProfile> {
    if (!Number.isInteger(input.capacitySeats) || input.capacitySeats < 0) throw new Error('capacitySeats must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO community_hall_profiles (id,workspace_id,tenant_id,hall_name,cda_registration,lga,state,capacity_seats,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.workspaceId, input.tenantId, input.hallName, input.cdaRegistration ?? null, input.lga, input.state, input.capacitySeats, 'seeded', ts, ts).run();
    return (await this.findProfileById(id, input.tenantId))!;
  }

  async findProfileById(id: string, tenantId: string): Promise<CommunityHallProfile | null> {
    const r = await this.db.prepare('SELECT * FROM community_hall_profiles WHERE id=? AND tenant_id=?').bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateStatus(id: string, tenantId: string, status: CommunityHallFSMState): Promise<void> {
    await this.db.prepare('UPDATE community_hall_profiles SET status=?,updated_at=? WHERE id=? AND tenant_id=?').bind(status, now(), id, tenantId).run();
  }

  async createBooking(input: CreateCommunityHallBookingInput): Promise<CommunityHallBooking> {
    if (!Number.isInteger(input.hireFeeKobo) || input.hireFeeKobo < 0) throw new Error('P9: hireFeeKobo must be a non-negative integer');
    if (!Number.isInteger(input.depositKobo) || input.depositKobo < 0) throw new Error('P9: depositKobo must be a non-negative integer');
    const clash = await this.db.prepare("SELECT id FROM community_hall_bookings WHERE profile_id=? AND tenant_id=? AND booking_date=? AND status NOT IN ('cancelled')").bind(input.profileId, input.tenantId, input.bookingDate).first();
    if (clash) throw new Error('Community hall already has a booking on this date');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO community_hall_bookings (id,profile_id,tenant_id,group_name,event_type,booking_date,hire_fee_kobo,deposit_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.groupName, input.eventType, input.bookingDate, input.hireFeeKobo, input.depositKobo, 'booked', ts, ts).run();
    return (await this.findBookingById(id, input.tenantId))!;
  }

  async findBookingById(id: string, tenantId: string): Promise<CommunityHallBooking | null> {
    const r = await this.db.prepare('SELECT * FROM community_hall_bookings WHERE id=? AND tenant_id=?').bind(id, tenantId).first<BookingRow>();
    return r ? rowToBooking(r) : null;
  }

  async createMaintenance(input: CreateCommunityHallMaintenanceInput): Promise<CommunityHallMaintenance> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo < 0) throw new Error('P9: amountKobo must be a non-negative integer');
    const id = input.id ?? uuid(); const ts = now();
    await this.db.prepare('INSERT INTO community_hall_maintenance (id,profile_id,tenant_id,contribution_date,contributor_ref,amount_kobo,purpose,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id, input.profileId, input.tenantId, input.contributionDate, input.contributorRef, input.amountKobo, input.purpose ?? null, ts, ts).run();
    return (await this.findMaintenanceById(id, input.tenantId))!;
  }

  async findMaintenanceById(id: string, tenantId: string): Promise<CommunityHallMaintenance | null> {
    const r = await this.db.prepare('SELECT * FROM community_hall_maintenance WHERE id=? AND tenant_id=?').bind(id, tenantId).first<MaintenanceRow>();
    return r ? rowToMaintenance(r) : null;
  }
}
