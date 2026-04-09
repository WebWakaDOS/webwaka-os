import type {
  CargoTruckProfile, CreateCargoTruckProfileInput, UpdateCargoTruckProfileInput,
  CargoTruckFSMState, CargoTruck, CreateCargoTruckInput, TruckStatus,
  CargoTrip, CreateCargoTripInput, TripStatus,
  TruckExpense, CreateTruckExpenseInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, cac_or_coop_number, frsc_operator_licence, status, created_at, updated_at';
const TRUCK_COLS = 'id, profile_id, tenant_id, plate, make, model, tonnage_kg, frsc_cert_expiry, status, created_at, updated_at';
const TRIP_COLS = 'id, truck_id, profile_id, tenant_id, origin, destination, cargo_description, cargo_weight_kg, hire_rate_kobo, client_phone, departure_date, arrival_date, status, created_at, updated_at';
const EXPENSE_COLS = 'id, truck_id, tenant_id, expense_type, amount_kobo, expense_date, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): CargoTruckProfile {
  return {
    id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string,
    companyName: r['company_name'] as string,
    cacOrCoopNumber: r['cac_or_coop_number'] as string | null,
    frscOperatorLicence: r['frsc_operator_licence'] as string | null,
    status: r['status'] as CargoTruckFSMState,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToTruck(r: Record<string, unknown>): CargoTruck {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    plate: r['plate'] as string, make: r['make'] as string | null, model: r['model'] as string | null,
    tonnageKg: r['tonnage_kg'] as number, frscCertExpiry: r['frsc_cert_expiry'] as number | null,
    status: r['status'] as TruckStatus,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToTrip(r: Record<string, unknown>): CargoTrip {
  return {
    id: r['id'] as string, truckId: r['truck_id'] as string, profileId: r['profile_id'] as string,
    tenantId: r['tenant_id'] as string, origin: r['origin'] as string | null,
    destination: r['destination'] as string | null, cargoDescription: r['cargo_description'] as string | null,
    cargoWeightKg: r['cargo_weight_kg'] as number, hireRateKobo: r['hire_rate_kobo'] as number,
    clientPhone: r['client_phone'] as string | null,
    departureDate: r['departure_date'] as number | null, arrivalDate: r['arrival_date'] as number | null,
    status: r['status'] as TripStatus,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToExpense(r: Record<string, unknown>): TruckExpense {
  return {
    id: r['id'] as string, truckId: r['truck_id'] as string, tenantId: r['tenant_id'] as string,
    expenseType: r['expense_type'] as TruckExpense['expenseType'],
    amountKobo: r['amount_kobo'] as number, expenseDate: r['expense_date'] as number | null,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

export class CargoTruckRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateCargoTruckProfileInput): Promise<CargoTruckProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO cargo_truck_profiles (id, workspace_id, tenant_id, company_name, cac_or_coop_number, frsc_operator_licence, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.cacOrCoopNumber ?? null, input.frscOperatorLicence ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[cargo-truck] profile create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<CargoTruckProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM cargo_truck_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<CargoTruckProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM cargo_truck_profiles WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateCargoTruckProfileInput): Promise<CargoTruckProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); vals.push(input.companyName); }
    if (input.cacOrCoopNumber !== undefined) { sets.push('cac_or_coop_number = ?'); vals.push(input.cacOrCoopNumber); }
    if (input.frscOperatorLicence !== undefined) { sets.push('frsc_operator_licence = ?'); vals.push(input.frscOperatorLicence); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    await this.db.prepare(`UPDATE cargo_truck_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionStatus(id: string, tenantId: string, to: CargoTruckFSMState): Promise<CargoTruckProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createTruck(input: CreateCargoTruckInput): Promise<CargoTruck> {
    if (!Number.isInteger(input.tonnageKg) || input.tonnageKg <= 0) throw new Error('[cargo-truck] tonnageKg must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO cargo_trucks (id, profile_id, tenant_id, plate, make, model, tonnage_kg, frsc_cert_expiry, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.plate, input.make ?? null, input.model ?? null, input.tonnageKg, input.frscCertExpiry ?? null).run();
    const t = await this.db.prepare(`SELECT ${TRUCK_COLS} FROM cargo_trucks WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!t) throw new Error('[cargo-truck] truck create failed');
    return rowToTruck(t);
  }

  async listTrucks(profileId: string, tenantId: string): Promise<CargoTruck[]> {
    const { results } = await this.db.prepare(`SELECT ${TRUCK_COLS} FROM cargo_trucks WHERE profile_id = ? AND tenant_id = ? ORDER BY plate ASC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToTruck);
  }

  async updateTruckStatus(id: string, tenantId: string, status: TruckStatus): Promise<CargoTruck | null> {
    await this.db.prepare(`UPDATE cargo_trucks SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    const row = await this.db.prepare(`SELECT ${TRUCK_COLS} FROM cargo_trucks WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToTruck(row) : null;
  }

  async createTrip(input: CreateCargoTripInput): Promise<CargoTrip> {
    if (!Number.isInteger(input.cargoWeightKg) || input.cargoWeightKg <= 0) throw new Error('[cargo-truck] cargoWeightKg must be positive integer (P9)');
    if (!Number.isInteger(input.hireRateKobo) || input.hireRateKobo < 0) throw new Error('[cargo-truck] hireRateKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO cargo_trips (id, truck_id, profile_id, tenant_id, origin, destination, cargo_description, cargo_weight_kg, hire_rate_kobo, client_phone, departure_date, arrival_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'loading', unixepoch(), unixepoch())`).bind(id, input.truckId, input.profileId, input.tenantId, input.origin ?? null, input.destination ?? null, input.cargoDescription ?? null, input.cargoWeightKg, input.hireRateKobo, input.clientPhone ?? null, input.departureDate ?? null).run();
    const t = await this.findTripById(id, input.tenantId);
    if (!t) throw new Error('[cargo-truck] trip create failed');
    return t;
  }

  async findTripById(id: string, tenantId: string): Promise<CargoTrip | null> {
    const row = await this.db.prepare(`SELECT ${TRIP_COLS} FROM cargo_trips WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToTrip(row) : null;
  }

  async listTrips(profileId: string, tenantId: string): Promise<CargoTrip[]> {
    const { results } = await this.db.prepare(`SELECT ${TRIP_COLS} FROM cargo_trips WHERE profile_id = ? AND tenant_id = ? ORDER BY departure_date DESC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToTrip);
  }

  async updateTripStatus(id: string, tenantId: string, status: TripStatus, arrivalDate?: number): Promise<CargoTrip | null> {
    if (arrivalDate !== undefined) {
      await this.db.prepare(`UPDATE cargo_trips SET status = ?, arrival_date = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, arrivalDate, id, tenantId).run();
    } else {
      await this.db.prepare(`UPDATE cargo_trips SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    }
    return this.findTripById(id, tenantId);
  }

  async createExpense(input: CreateTruckExpenseInput): Promise<TruckExpense> {
    if (!Number.isInteger(input.amountKobo) || input.amountKobo < 0) throw new Error('[cargo-truck] amountKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO truck_expenses (id, truck_id, tenant_id, expense_type, amount_kobo, expense_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.truckId, input.tenantId, input.expenseType ?? 'fuel', input.amountKobo, input.expenseDate ?? null).run();
    const e = await this.db.prepare(`SELECT ${EXPENSE_COLS} FROM truck_expenses WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!e) throw new Error('[cargo-truck] expense create failed');
    return rowToExpense(e);
  }

  async listExpenses(truckId: string, tenantId: string): Promise<TruckExpense[]> {
    const { results } = await this.db.prepare(`SELECT ${EXPENSE_COLS} FROM truck_expenses WHERE truck_id = ? AND tenant_id = ? ORDER BY expense_date DESC`).bind(truckId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToExpense);
  }
}
