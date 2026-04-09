import type { FuelStationProfile, CreateFuelStationInput, UpdateFuelStationInput, FuelStationFSMState, FuelPump, CreateFuelPumpInput, FuelDailyReading, CreateFuelDailyReadingInput, FuelTankStock, CreateFuelTankStockInput } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, station_name, nuprc_licence, nuprc_expiry, dealer_type, cac_number, state, lga, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): FuelStationProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, stationName: r['station_name'] as string, nuprcLicence: r['nuprc_licence'] as string | null, nuprcExpiry: r['nuprc_expiry'] as number | null, dealerType: r['dealer_type'] as FuelStationProfile['dealerType'], cacNumber: r['cac_number'] as string | null, state: r['state'] as string | null, lga: r['lga'] as string | null, status: r['status'] as FuelStationFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const PUMP_COLS = 'id, station_id, workspace_id, tenant_id, pump_number, product, current_price_kobo_per_litre, created_at, updated_at';
function rowToPump(r: Record<string, unknown>): FuelPump {
  return { id: r['id'] as string, stationId: r['station_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, pumpNumber: r['pump_number'] as string, product: r['product'] as FuelPump['product'], currentPriceKoboPerLitre: r['current_price_kobo_per_litre'] as number, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const READING_COLS = 'id, pump_id, workspace_id, tenant_id, shift_date, opening_meter, closing_meter, litres_sold_ml, cash_received_kobo, attendant_name, created_at, updated_at';
function rowToReading(r: Record<string, unknown>): FuelDailyReading {
  return { id: r['id'] as string, pumpId: r['pump_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, shiftDate: r['shift_date'] as number, openingMeter: r['opening_meter'] as number, closingMeter: r['closing_meter'] as number, litresSoldMl: r['litres_sold_ml'] as number, cashReceivedKobo: r['cash_received_kobo'] as number, attendantName: r['attendant_name'] as string | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const TANK_COLS = 'id, station_id, workspace_id, tenant_id, product, capacity_ml, current_level_ml, last_delivery_ml, last_delivery_date, created_at, updated_at';
function rowToTank(r: Record<string, unknown>): FuelTankStock {
  return { id: r['id'] as string, stationId: r['station_id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, product: r['product'] as FuelTankStock['product'], capacityMl: r['capacity_ml'] as number, currentLevelMl: r['current_level_ml'] as number, lastDeliveryMl: r['last_delivery_ml'] as number, lastDeliveryDate: r['last_delivery_date'] as number | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class FuelStationRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateFuelStationInput): Promise<FuelStationProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO fuel_station_profiles (id, workspace_id, tenant_id, station_name, nuprc_licence, nuprc_expiry, dealer_type, cac_number, state, lga, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.stationName, input.nuprcLicence ?? null, input.nuprcExpiry ?? null, input.dealerType ?? null, input.cacNumber ?? null, input.state ?? null, input.lga ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[fuel-station] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<FuelStationProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM fuel_station_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<FuelStationProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM fuel_station_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateFuelStationInput): Promise<FuelStationProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.stationName !== undefined) { sets.push('station_name = ?'); b.push(input.stationName); }
    if ('nuprcLicence' in input) { sets.push('nuprc_licence = ?'); b.push(input.nuprcLicence ?? null); }
    if ('nuprcExpiry' in input) { sets.push('nuprc_expiry = ?'); b.push(input.nuprcExpiry ?? null); }
    if ('dealerType' in input) { sets.push('dealer_type = ?'); b.push(input.dealerType ?? null); }
    if ('cacNumber' in input) { sets.push('cac_number = ?'); b.push(input.cacNumber ?? null); }
    if ('state' in input) { sets.push('state = ?'); b.push(input.state ?? null); }
    if ('lga' in input) { sets.push('lga = ?'); b.push(input.lga ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE fuel_station_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: FuelStationFSMState): Promise<FuelStationProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createPump(input: CreateFuelPumpInput): Promise<FuelPump> {
    if (!Number.isInteger(input.currentPriceKoboPerLitre) || input.currentPriceKoboPerLitre < 0) throw new Error('[fuel-station] currentPriceKoboPerLitre must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO fuel_pumps (id, station_id, workspace_id, tenant_id, pump_number, product, current_price_kobo_per_litre, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.stationId, input.workspaceId, input.tenantId, input.pumpNumber, input.product, input.currentPriceKoboPerLitre).run();
    const p = await this.findPumpById(id, input.tenantId); if (!p) throw new Error('[fuel-station] pump create failed'); return p;
  }

  async findPumpById(id: string, tenantId: string): Promise<FuelPump | null> {
    const row = await this.db.prepare(`SELECT ${PUMP_COLS} FROM fuel_pumps WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToPump(row) : null;
  }

  async listPumps(stationId: string, tenantId: string): Promise<FuelPump[]> {
    const { results } = await this.db.prepare(`SELECT ${PUMP_COLS} FROM fuel_pumps WHERE station_id = ? AND tenant_id = ? ORDER BY pump_number ASC`).bind(stationId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToPump);
  }

  async createDailyReading(input: CreateFuelDailyReadingInput): Promise<FuelDailyReading> {
    if (!Number.isInteger(input.litresSoldMl) || input.litresSoldMl < 0) throw new Error('[fuel-station] litresSoldMl must be non-negative integer (no floats)');
    if (!Number.isInteger(input.cashReceivedKobo) || input.cashReceivedKobo < 0) throw new Error('[fuel-station] cashReceivedKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO fuel_daily_readings (id, pump_id, workspace_id, tenant_id, shift_date, opening_meter, closing_meter, litres_sold_ml, cash_received_kobo, attendant_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.pumpId, input.workspaceId, input.tenantId, input.shiftDate, input.openingMeter, input.closingMeter, input.litresSoldMl, input.cashReceivedKobo, input.attendantName ?? null).run();
    const r = await this.findReadingById(id, input.tenantId); if (!r) throw new Error('[fuel-station] reading create failed'); return r;
  }

  async findReadingById(id: string, tenantId: string): Promise<FuelDailyReading | null> {
    const row = await this.db.prepare(`SELECT ${READING_COLS} FROM fuel_daily_readings WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToReading(row) : null;
  }

  async listReadings(pumpId: string, tenantId: string): Promise<FuelDailyReading[]> {
    const { results } = await this.db.prepare(`SELECT ${READING_COLS} FROM fuel_daily_readings WHERE pump_id = ? AND tenant_id = ? ORDER BY shift_date DESC`).bind(pumpId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToReading);
  }

  async createTankStock(input: CreateFuelTankStockInput): Promise<FuelTankStock> {
    if (!Number.isInteger(input.capacityMl) || input.capacityMl <= 0) throw new Error('[fuel-station] capacityMl must be positive integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO fuel_tank_stock (id, station_id, workspace_id, tenant_id, product, capacity_ml, current_level_ml, last_delivery_ml, last_delivery_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.stationId, input.workspaceId, input.tenantId, input.product, input.capacityMl, input.currentLevelMl ?? 0, input.lastDeliveryMl ?? 0, input.lastDeliveryDate ?? null).run();
    const t = await this.findTankById(id, input.tenantId); if (!t) throw new Error('[fuel-station] tank create failed'); return t;
  }

  async findTankById(id: string, tenantId: string): Promise<FuelTankStock | null> {
    const row = await this.db.prepare(`SELECT ${TANK_COLS} FROM fuel_tank_stock WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToTank(row) : null;
  }

  async listTanks(stationId: string, tenantId: string): Promise<FuelTankStock[]> {
    const { results } = await this.db.prepare(`SELECT ${TANK_COLS} FROM fuel_tank_stock WHERE station_id = ? AND tenant_id = ?`).bind(stationId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToTank);
  }
}
