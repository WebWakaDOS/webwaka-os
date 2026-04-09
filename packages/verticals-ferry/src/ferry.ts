import type {
  FerryOperatorProfile, CreateFerryProfileInput, UpdateFerryProfileInput,
  FerryFSMState, FerryVessel, CreateFerryVesselInput,
  FerryTrip, CreateFerryTripInput, TripStatus,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, nimasa_licence, nrc_compliance, cac_rc, status, created_at, updated_at';
const VESSEL_COLS = 'id, profile_id, tenant_id, vessel_name, type, capacity_passengers, nimasa_reg, route_description, status, created_at, updated_at';
const TRIP_COLS = 'id, vessel_id, profile_id, tenant_id, route, departure_time, arrival_time, passenger_count, ticket_price_kobo, total_revenue_kobo, status, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): FerryOperatorProfile {
  return {
    id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string,
    companyName: r['company_name'] as string, nimasaLicence: r['nimasa_licence'] as string | null,
    nrcCompliance: Boolean(r['nrc_compliance']), cacRc: r['cac_rc'] as string | null,
    status: r['status'] as FerryFSMState,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToVessel(r: Record<string, unknown>): FerryVessel {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    vesselName: r['vessel_name'] as string, type: r['type'] as FerryVessel['type'],
    capacityPassengers: r['capacity_passengers'] as number,
    nimasaReg: r['nimasa_reg'] as string | null, routeDescription: r['route_description'] as string | null,
    status: r['status'] as FerryVessel['status'],
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToTrip(r: Record<string, unknown>): FerryTrip {
  return {
    id: r['id'] as string, vesselId: r['vessel_id'] as string, profileId: r['profile_id'] as string,
    tenantId: r['tenant_id'] as string, route: r['route'] as string | null,
    departureTime: r['departure_time'] as number | null, arrivalTime: r['arrival_time'] as number | null,
    passengerCount: r['passenger_count'] as number,
    ticketPriceKobo: r['ticket_price_kobo'] as number,
    totalRevenueKobo: r['total_revenue_kobo'] as number,
    status: r['status'] as TripStatus,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

export class FerryRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateFerryProfileInput): Promise<FerryOperatorProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO ferry_operator_profiles (id, workspace_id, tenant_id, company_name, nimasa_licence, nrc_compliance, cac_rc, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.nimasaLicence ?? null, input.nrcCompliance ? 1 : 0, input.cacRc ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[ferry] profile create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<FerryOperatorProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM ferry_operator_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<FerryOperatorProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM ferry_operator_profiles WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateFerryProfileInput): Promise<FerryOperatorProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); vals.push(input.companyName); }
    if (input.nimasaLicence !== undefined) { sets.push('nimasa_licence = ?'); vals.push(input.nimasaLicence); }
    if (input.nrcCompliance !== undefined) { sets.push('nrc_compliance = ?'); vals.push(input.nrcCompliance ? 1 : 0); }
    if (input.cacRc !== undefined) { sets.push('cac_rc = ?'); vals.push(input.cacRc); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    await this.db.prepare(`UPDATE ferry_operator_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionStatus(id: string, tenantId: string, to: FerryFSMState): Promise<FerryOperatorProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createVessel(input: CreateFerryVesselInput): Promise<FerryVessel> {
    if (!Number.isInteger(input.capacityPassengers) || input.capacityPassengers <= 0) throw new Error('[ferry] capacityPassengers must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO ferry_vessels (id, profile_id, tenant_id, vessel_name, type, capacity_passengers, nimasa_reg, route_description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'operational', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.vesselName, input.type ?? 'ferry', input.capacityPassengers, input.nimasaReg ?? null, input.routeDescription ?? null).run();
    const v = await this.db.prepare(`SELECT ${VESSEL_COLS} FROM ferry_vessels WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!v) throw new Error('[ferry] vessel create failed');
    return rowToVessel(v);
  }

  async listVessels(profileId: string, tenantId: string): Promise<FerryVessel[]> {
    const { results } = await this.db.prepare(`SELECT ${VESSEL_COLS} FROM ferry_vessels WHERE profile_id = ? AND tenant_id = ? ORDER BY vessel_name ASC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToVessel);
  }

  async createTrip(input: CreateFerryTripInput): Promise<FerryTrip> {
    if (!Number.isInteger(input.passengerCount) || input.passengerCount < 0) throw new Error('[ferry] passengerCount must be non-negative integer (P9)');
    if (!Number.isInteger(input.ticketPriceKobo) || input.ticketPriceKobo < 0) throw new Error('[ferry] ticketPriceKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.totalRevenueKobo) || input.totalRevenueKobo < 0) throw new Error('[ferry] totalRevenueKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO ferry_trips (id, vessel_id, profile_id, tenant_id, route, departure_time, arrival_time, passenger_count, ticket_price_kobo, total_revenue_kobo, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'scheduled', unixepoch(), unixepoch())`).bind(id, input.vesselId, input.profileId, input.tenantId, input.route ?? null, input.departureTime ?? null, input.passengerCount, input.ticketPriceKobo, input.totalRevenueKobo).run();
    const t = await this.findTripById(id, input.tenantId);
    if (!t) throw new Error('[ferry] trip create failed');
    return t;
  }

  async findTripById(id: string, tenantId: string): Promise<FerryTrip | null> {
    const row = await this.db.prepare(`SELECT ${TRIP_COLS} FROM ferry_trips WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToTrip(row) : null;
  }

  async listTrips(profileId: string, tenantId: string): Promise<FerryTrip[]> {
    const { results } = await this.db.prepare(`SELECT ${TRIP_COLS} FROM ferry_trips WHERE profile_id = ? AND tenant_id = ? ORDER BY departure_time DESC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToTrip);
  }

  async updateTripStatus(id: string, tenantId: string, status: TripStatus, arrivalTime?: number): Promise<FerryTrip | null> {
    if (arrivalTime !== undefined) {
      await this.db.prepare(`UPDATE ferry_trips SET status = ?, arrival_time = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, arrivalTime, id, tenantId).run();
    } else {
      await this.db.prepare(`UPDATE ferry_trips SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    }
    return this.findTripById(id, tenantId);
  }
}
