import type { TravelAgentProfile, CreateTravelAgentInput, UpdateTravelAgentInput, TravelAgentFSMState, TravelPackage, CreateTravelPackageInput, TravelBooking, CreateTravelBookingInput, BookingStatus, VisaStatus } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, agency_name, nanta_number, iata_code, cac_rc, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): TravelAgentProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, agencyName: r['agency_name'] as string, nantaNumber: r['nanta_number'] as string | null, iataCode: r['iata_code'] as string | null, cacRc: r['cac_rc'] as string | null, status: r['status'] as TravelAgentFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const PACKAGE_COLS = 'id, workspace_id, tenant_id, package_name, destination, type, duration_days, price_per_pax_kobo, inclusions, created_at, updated_at';
function rowToPackage(r: Record<string, unknown>): TravelPackage {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, packageName: r['package_name'] as string, destination: r['destination'] as string, type: r['type'] as TravelPackage['type'], durationDays: r['duration_days'] as number, pricePerPaxKobo: r['price_per_pax_kobo'] as number, inclusions: r['inclusions'] as string, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const BOOKING_COLS = 'id, workspace_id, tenant_id, client_phone, package_id, travel_date, pax_count, total_kobo, deposit_kobo, balance_kobo, visa_status, status, created_at, updated_at';
function rowToBooking(r: Record<string, unknown>): TravelBooking {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, clientPhone: r['client_phone'] as string, packageId: r['package_id'] as string, travelDate: r['travel_date'] as number, paxCount: r['pax_count'] as number, totalKobo: r['total_kobo'] as number, depositKobo: r['deposit_kobo'] as number, balanceKobo: r['balance_kobo'] as number, visaStatus: r['visa_status'] as VisaStatus, status: r['status'] as BookingStatus, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class TravelAgentRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateTravelAgentInput): Promise<TravelAgentProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO travel_agent_profiles (id, workspace_id, tenant_id, agency_name, nanta_number, iata_code, cac_rc, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.agencyName, input.nantaNumber ?? null, input.iataCode ?? null, input.cacRc ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[travel-agent] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<TravelAgentProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM travel_agent_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<TravelAgentProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM travel_agent_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateTravelAgentInput): Promise<TravelAgentProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.agencyName !== undefined) { sets.push('agency_name = ?'); b.push(input.agencyName); }
    if ('nantaNumber' in input) { sets.push('nanta_number = ?'); b.push(input.nantaNumber ?? null); }
    if ('iataCode' in input) { sets.push('iata_code = ?'); b.push(input.iataCode ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc = ?'); b.push(input.cacRc ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE travel_agent_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: TravelAgentFSMState): Promise<TravelAgentProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createPackage(input: CreateTravelPackageInput): Promise<TravelPackage> {
    if (!Number.isInteger(input.pricePerPaxKobo) || input.pricePerPaxKobo <= 0) throw new Error('[travel-agent] pricePerPaxKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO travel_packages (id, workspace_id, tenant_id, package_name, destination, type, duration_days, price_per_pax_kobo, inclusions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.packageName, input.destination, input.type, input.durationDays ?? 1, input.pricePerPaxKobo, input.inclusions ?? '[]').run();
    const p = await this.findPackageById(id, input.tenantId); if (!p) throw new Error('[travel-agent] package create failed'); return p;
  }

  async findPackageById(id: string, tenantId: string): Promise<TravelPackage | null> {
    const row = await this.db.prepare(`SELECT ${PACKAGE_COLS} FROM travel_packages WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToPackage(row) : null;
  }

  async listPackages(workspaceId: string, tenantId: string): Promise<TravelPackage[]> {
    const { results } = await this.db.prepare(`SELECT ${PACKAGE_COLS} FROM travel_packages WHERE workspace_id = ? AND tenant_id = ? ORDER BY package_name ASC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToPackage);
  }

  async createBooking(input: CreateTravelBookingInput): Promise<TravelBooking> {
    if (!Number.isInteger(input.totalKobo) || input.totalKobo <= 0) throw new Error('[travel-agent] totalKobo must be positive integer (P9)');
    if (!Number.isInteger(input.depositKobo) || input.depositKobo < 0) throw new Error('[travel-agent] depositKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.balanceKobo) || input.balanceKobo < 0) throw new Error('[travel-agent] balanceKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO travel_bookings (id, workspace_id, tenant_id, client_phone, package_id, travel_date, pax_count, total_kobo, deposit_kobo, balance_kobo, visa_status, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enquiry', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clientPhone, input.packageId, input.travelDate, input.paxCount ?? 1, input.totalKobo, input.depositKobo, input.balanceKobo, input.visaStatus ?? 'not_required').run();
    const b = await this.findBookingById(id, input.tenantId); if (!b) throw new Error('[travel-agent] booking create failed'); return b;
  }

  async findBookingById(id: string, tenantId: string): Promise<TravelBooking | null> {
    const row = await this.db.prepare(`SELECT ${BOOKING_COLS} FROM travel_bookings WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToBooking(row) : null;
  }

  async listBookings(workspaceId: string, tenantId: string): Promise<TravelBooking[]> {
    const { results } = await this.db.prepare(`SELECT ${BOOKING_COLS} FROM travel_bookings WHERE workspace_id = ? AND tenant_id = ? ORDER BY travel_date ASC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToBooking);
  }

  async updateBookingStatus(id: string, tenantId: string, status: BookingStatus): Promise<TravelBooking | null> {
    await this.db.prepare(`UPDATE travel_bookings SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findBookingById(id, tenantId);
  }

  async updateVisaStatus(id: string, tenantId: string, visaStatus: VisaStatus): Promise<TravelBooking | null> {
    await this.db.prepare(`UPDATE travel_bookings SET visa_status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(visaStatus, id, tenantId).run();
    return this.findBookingById(id, tenantId);
  }
}
