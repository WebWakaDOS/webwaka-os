import type {
  CourierProfile, CreateCourierInput, UpdateCourierInput, CourierFSMState,
  CourierRider, CreateRiderInput, CourierParcel, CreateParcelInput, ParcelStatus,
  CodRemittance, CreateCodRemittanceInput,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, ncc_registered, cac_rc, status, created_at, updated_at';
const RIDER_COLS = 'id, profile_id, tenant_id, rider_name, phone, vehicle_type, license_number, status, created_at, updated_at';
const PARCEL_COLS = 'id, profile_id, tenant_id, tracking_code, sender_phone, receiver_phone, weight_grams, description, pickup_address, delivery_address, delivery_fee_kobo, cod_amount_kobo, rider_id, status, created_at, updated_at';
const COD_COLS = 'id, parcel_id, tenant_id, collected_kobo, remitted_kobo, remittance_date, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): CourierProfile {
  return {
    id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string,
    companyName: r['company_name'] as string, nccRegistered: Boolean(r['ncc_registered']),
    cacRc: r['cac_rc'] as string | null, status: r['status'] as CourierFSMState,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToRider(r: Record<string, unknown>): CourierRider {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    riderName: r['rider_name'] as string, phone: r['phone'] as string | null,
    vehicleType: r['vehicle_type'] as CourierRider['vehicleType'],
    licenseNumber: r['license_number'] as string | null,
    status: r['status'] as CourierRider['status'],
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToParcel(r: Record<string, unknown>): CourierParcel {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    trackingCode: r['tracking_code'] as string, senderPhone: r['sender_phone'] as string | null,
    receiverPhone: r['receiver_phone'] as string | null, weightGrams: r['weight_grams'] as number,
    description: r['description'] as string | null, pickupAddress: r['pickup_address'] as string | null,
    deliveryAddress: r['delivery_address'] as string | null,
    deliveryFeeKobo: r['delivery_fee_kobo'] as number, codAmountKobo: r['cod_amount_kobo'] as number,
    riderId: r['rider_id'] as string | null, status: r['status'] as ParcelStatus,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToCod(r: Record<string, unknown>): CodRemittance {
  return {
    id: r['id'] as string, parcelId: r['parcel_id'] as string, tenantId: r['tenant_id'] as string,
    collectedKobo: r['collected_kobo'] as number, remittedKobo: r['remitted_kobo'] as number,
    remittanceDate: r['remittance_date'] as number | null,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

export class CourierRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateCourierInput): Promise<CourierProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO courier_profiles (id, workspace_id, tenant_id, company_name, ncc_registered, cac_rc, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.nccRegistered ? 1 : 0, input.cacRc ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[courier] profile create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<CourierProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM courier_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<CourierProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM courier_profiles WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateCourierInput): Promise<CourierProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); vals.push(input.companyName); }
    if (input.nccRegistered !== undefined) { sets.push('ncc_registered = ?'); vals.push(input.nccRegistered ? 1 : 0); }
    if (input.cacRc !== undefined) { sets.push('cac_rc = ?'); vals.push(input.cacRc); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    await this.db.prepare(`UPDATE courier_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionStatus(id: string, tenantId: string, to: CourierFSMState): Promise<CourierProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createRider(input: CreateRiderInput): Promise<CourierRider> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO courier_riders (id, profile_id, tenant_id, rider_name, phone, vehicle_type, license_number, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.riderName, input.phone ?? null, input.vehicleType ?? 'motorcycle', input.licenseNumber ?? null).run();
    const r = await this.db.prepare(`SELECT ${RIDER_COLS} FROM courier_riders WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!r) throw new Error('[courier] rider create failed');
    return rowToRider(r);
  }

  async listRiders(profileId: string, tenantId: string): Promise<CourierRider[]> {
    const { results } = await this.db.prepare(`SELECT ${RIDER_COLS} FROM courier_riders WHERE profile_id = ? AND tenant_id = ? ORDER BY rider_name ASC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToRider);
  }

  async createParcel(input: CreateParcelInput): Promise<CourierParcel> {
    if (!Number.isInteger(input.weightGrams) || input.weightGrams <= 0) throw new Error('[courier] weightGrams must be positive integer (P9)');
    if (!Number.isInteger(input.deliveryFeeKobo) || input.deliveryFeeKobo < 0) throw new Error('[courier] deliveryFeeKobo must be non-negative integer (P9)');
    const codAmountKobo = input.codAmountKobo ?? 0;
    if (!Number.isInteger(codAmountKobo)) throw new Error('[courier] codAmountKobo must be integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO courier_parcels (id, profile_id, tenant_id, tracking_code, sender_phone, receiver_phone, weight_grams, description, pickup_address, delivery_address, delivery_fee_kobo, cod_amount_kobo, rider_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'intake', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.trackingCode, input.senderPhone ?? null, input.receiverPhone ?? null, input.weightGrams, input.description ?? null, input.pickupAddress ?? null, input.deliveryAddress ?? null, input.deliveryFeeKobo, codAmountKobo).run();
    const p = await this.findParcelById(id, input.tenantId);
    if (!p) throw new Error('[courier] parcel create failed');
    return p;
  }

  async findParcelById(id: string, tenantId: string): Promise<CourierParcel | null> {
    const row = await this.db.prepare(`SELECT ${PARCEL_COLS} FROM courier_parcels WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToParcel(row) : null;
  }

  async listParcels(profileId: string, tenantId: string): Promise<CourierParcel[]> {
    const { results } = await this.db.prepare(`SELECT ${PARCEL_COLS} FROM courier_parcels WHERE profile_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToParcel);
  }

  async updateParcelStatus(id: string, tenantId: string, status: ParcelStatus, riderId?: string): Promise<CourierParcel | null> {
    if (riderId !== undefined) {
      await this.db.prepare(`UPDATE courier_parcels SET status = ?, rider_id = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, riderId, id, tenantId).run();
    } else {
      await this.db.prepare(`UPDATE courier_parcels SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    }
    return this.findParcelById(id, tenantId);
  }

  async createCodRemittance(input: CreateCodRemittanceInput): Promise<CodRemittance> {
    if (!Number.isInteger(input.collectedKobo) || input.collectedKobo < 0) throw new Error('[courier] collectedKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.remittedKobo) || input.remittedKobo < 0) throw new Error('[courier] remittedKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO courier_cod_remittances (id, parcel_id, tenant_id, collected_kobo, remitted_kobo, remittance_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.parcelId, input.tenantId, input.collectedKobo, input.remittedKobo, input.remittanceDate ?? null).run();
    const r = await this.db.prepare(`SELECT ${COD_COLS} FROM courier_cod_remittances WHERE id = ? AND tenant_id = ?`).bind(id, input.tenantId).first<Record<string, unknown>>();
    if (!r) throw new Error('[courier] COD remittance create failed');
    return rowToCod(r);
  }

  async listCodRemittances(parcelId: string, tenantId: string): Promise<CodRemittance[]> {
    const { results } = await this.db.prepare(`SELECT ${COD_COLS} FROM courier_cod_remittances WHERE parcel_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(parcelId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToCod);
  }
}
