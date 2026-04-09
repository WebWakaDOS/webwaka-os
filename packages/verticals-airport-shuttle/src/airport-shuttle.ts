/**
 * @webwaka/verticals-airport-shuttle — Repository
 * Platform Invariants: T3 (tenant_id scoped), P9 (kobo integers enforced)
 * P13: passenger_phone, flight_number stripped before AI calls
 */

import type {
  AirportShuttleProfile, CreateAirportShuttleInput, UpdateAirportShuttleInput,
  AirportShuttleFSMState, ShuttleVehicle, CreateShuttleVehicleInput,
  ShuttleBooking, CreateShuttleBookingInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, faan_permit, frsc_commercial_licence, cac_rc, status, created_at, updated_at';
const VEHICLE_COLS = 'id, profile_id, tenant_id, vehicle_plate, type, capacity, driver_id, frsc_cert, status, created_at, updated_at';
const BOOKING_COLS = 'id, profile_id, tenant_id, passenger_phone, flight_number, pickup_airport, destination, pickup_time, driver_id, vehicle_id, fare_kobo, status, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): AirportShuttleProfile {
  return {
    id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string,
    companyName: r['company_name'] as string, faanPermit: r['faan_permit'] as string | null,
    frscCommercialLicence: r['frsc_commercial_licence'] as string | null, cacRc: r['cac_rc'] as string | null,
    status: r['status'] as AirportShuttleFSMState,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToVehicle(r: Record<string, unknown>): ShuttleVehicle {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    vehiclePlate: r['vehicle_plate'] as string, type: r['type'] as ShuttleVehicle['type'],
    capacity: r['capacity'] as number, driverId: r['driver_id'] as string | null,
    frscCert: r['frsc_cert'] as string | null, status: r['status'] as ShuttleVehicle['status'],
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToBooking(r: Record<string, unknown>): ShuttleBooking {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    passengerPhone: r['passenger_phone'] as string | null, flightNumber: r['flight_number'] as string | null,
    pickupAirport: r['pickup_airport'] as string | null, destination: r['destination'] as string | null,
    pickupTime: r['pickup_time'] as number | null, driverId: r['driver_id'] as string | null,
    vehicleId: r['vehicle_id'] as string | null, fareKobo: r['fare_kobo'] as number,
    status: r['status'] as ShuttleBooking['status'],
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

export class AirportShuttleRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateAirportShuttleInput): Promise<AirportShuttleProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO airport_shuttle_profiles (id, workspace_id, tenant_id, company_name, faan_permit, frsc_commercial_licence, cac_rc, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.faanPermit ?? null, input.frscCommercialLicence ?? null, input.cacRc ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[airport-shuttle] profile create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<AirportShuttleProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM airport_shuttle_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<AirportShuttleProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM airport_shuttle_profiles WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateAirportShuttleInput): Promise<AirportShuttleProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); vals.push(input.companyName); }
    if (input.faanPermit !== undefined) { sets.push('faan_permit = ?'); vals.push(input.faanPermit); }
    if (input.frscCommercialLicence !== undefined) { sets.push('frsc_commercial_licence = ?'); vals.push(input.frscCommercialLicence); }
    if (input.cacRc !== undefined) { sets.push('cac_rc = ?'); vals.push(input.cacRc); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    await this.db.prepare(`UPDATE airport_shuttle_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionStatus(id: string, tenantId: string, to: AirportShuttleFSMState): Promise<AirportShuttleProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createVehicle(input: CreateShuttleVehicleInput): Promise<ShuttleVehicle> {
    const capacity = input.capacity ?? 4;
    if (!Number.isInteger(capacity) || capacity <= 0) throw new Error('[airport-shuttle] capacity must be positive integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO shuttle_vehicles (id, profile_id, tenant_id, vehicle_plate, type, capacity, driver_id, frsc_cert, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.vehiclePlate, input.type ?? 'sedan', capacity, input.driverId ?? null, input.frscCert ?? null).run();
    const v = await this.findVehicleById(id, input.tenantId);
    if (!v) throw new Error('[airport-shuttle] vehicle create failed');
    return v;
  }

  async findVehicleById(id: string, tenantId: string): Promise<ShuttleVehicle | null> {
    const row = await this.db.prepare(`SELECT ${VEHICLE_COLS} FROM shuttle_vehicles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToVehicle(row) : null;
  }

  async listVehicles(profileId: string, tenantId: string): Promise<ShuttleVehicle[]> {
    const { results } = await this.db.prepare(`SELECT ${VEHICLE_COLS} FROM shuttle_vehicles WHERE profile_id = ? AND tenant_id = ?`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToVehicle);
  }

  async createBooking(input: CreateShuttleBookingInput): Promise<ShuttleBooking> {
    if (!Number.isInteger(input.fareKobo) || input.fareKobo < 0) throw new Error('[airport-shuttle] fareKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO shuttle_bookings (id, profile_id, tenant_id, passenger_phone, flight_number, pickup_airport, destination, pickup_time, driver_id, vehicle_id, fare_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'booked', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.passengerPhone ?? null, input.flightNumber ?? null, input.pickupAirport ?? null, input.destination ?? null, input.pickupTime ?? null, input.fareKobo).run();
    const b = await this.findBookingById(id, input.tenantId);
    if (!b) throw new Error('[airport-shuttle] booking create failed');
    return b;
  }

  async findBookingById(id: string, tenantId: string): Promise<ShuttleBooking | null> {
    const row = await this.db.prepare(`SELECT ${BOOKING_COLS} FROM shuttle_bookings WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToBooking(row) : null;
  }

  async listBookings(profileId: string, tenantId: string): Promise<ShuttleBooking[]> {
    const { results } = await this.db.prepare(`SELECT ${BOOKING_COLS} FROM shuttle_bookings WHERE profile_id = ? AND tenant_id = ? ORDER BY pickup_time ASC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToBooking);
  }

  async updateBookingStatus(id: string, tenantId: string, status: ShuttleBooking['status'], vehicleId?: string, driverId?: string): Promise<ShuttleBooking | null> {
    const sets: string[] = ['status = ?', 'updated_at = unixepoch()']; const vals: unknown[] = [status];
    if (vehicleId !== undefined) { sets.push('vehicle_id = ?'); vals.push(vehicleId); }
    if (driverId !== undefined) { sets.push('driver_id = ?'); vals.push(driverId); }
    await this.db.prepare(`UPDATE shuttle_bookings SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findBookingById(id, tenantId);
  }
}
