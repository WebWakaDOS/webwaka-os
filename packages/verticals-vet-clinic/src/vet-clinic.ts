/**
 * VetClinicRepository — M10
 * T3: all queries scoped to tenantId
 * P9: consultation_fee_kobo, cost_kobo, unit_price_kobo are integers
 * P13: animal_ref_id and owner_ref_id are opaque UUIDs — no clinical diagnosis
 */

import type {
  VetClinicProfile, VetPatient, VetAppointment, VetVaccination, VetShopInventoryItem,
  VetClinicFSMState,
  CreateVetClinicInput, UpdateVetClinicInput,
  CreateVetPatientInput, CreateVetAppointmentInput, CreateVetVaccinationInput, CreateVetShopItemInput,
} from './types.js';

interface D1Like {
  prepare(s: string): {
    bind(...v: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

interface ProfileRow { id: string; workspace_id: string; tenant_id: string; clinic_name: string; vcnb_registration: string | null; cac_rc: string | null; clinic_type: string; status: string; created_at: number; updated_at: number; }
interface PatientRow { id: string; profile_id: string; tenant_id: string; animal_ref_id: string; species: string; breed: string | null; owner_ref_id: string; age_months: number | null; created_at: number; updated_at: number; }
interface ApptRow { id: string; profile_id: string; tenant_id: string; animal_ref_id: string; vet_id: string; appointment_time: number; appointment_type: string; consultation_fee_kobo: number; status: string; created_at: number; updated_at: number; }
interface VaccRow { id: string; profile_id: string; tenant_id: string; animal_ref_id: string; vaccine_name: string; date_administered: number; next_due: number | null; cost_kobo: number; created_at: number; }
interface ShopRow { id: string; profile_id: string; tenant_id: string; product_name: string; category: string; unit_price_kobo: number; quantity_in_stock: number; created_at: number; updated_at: number; }

function rowToProfile(r: ProfileRow): VetClinicProfile { return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, clinicName: r.clinic_name, vcnbRegistration: r.vcnb_registration, cacRc: r.cac_rc, clinicType: r.clinic_type as VetClinicProfile['clinicType'], status: r.status as VetClinicFSMState, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToPatient(r: PatientRow): VetPatient { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, animalRefId: r.animal_ref_id, species: r.species, breed: r.breed, ownerRefId: r.owner_ref_id, ageMonths: r.age_months, createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToAppt(r: ApptRow): VetAppointment { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, animalRefId: r.animal_ref_id, vetId: r.vet_id, appointmentTime: r.appointment_time, appointmentType: r.appointment_type as VetAppointment['appointmentType'], consultationFeeKobo: r.consultation_fee_kobo, status: r.status as VetAppointment['status'], createdAt: r.created_at, updatedAt: r.updated_at }; }
function rowToVacc(r: VaccRow): VetVaccination { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, animalRefId: r.animal_ref_id, vaccineName: r.vaccine_name, dateAdministered: r.date_administered, nextDue: r.next_due, costKobo: r.cost_kobo, createdAt: r.created_at }; }
function rowToShop(r: ShopRow): VetShopInventoryItem { return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, productName: r.product_name, category: r.category as VetShopInventoryItem['category'], unitPriceKobo: r.unit_price_kobo, quantityInStock: r.quantity_in_stock, createdAt: r.created_at, updatedAt: r.updated_at }; }

const PC = 'id,workspace_id,tenant_id,clinic_name,vcnb_registration,cac_rc,clinic_type,status,created_at,updated_at';
const PAC = 'id,profile_id,tenant_id,animal_ref_id,species,breed,owner_ref_id,age_months,created_at,updated_at';
const AC = 'id,profile_id,tenant_id,animal_ref_id,vet_id,appointment_time,appointment_type,consultation_fee_kobo,status,created_at,updated_at';
const VC = 'id,profile_id,tenant_id,animal_ref_id,vaccine_name,date_administered,next_due,cost_kobo,created_at';
const SC = 'id,profile_id,tenant_id,product_name,category,unit_price_kobo,quantity_in_stock,created_at,updated_at';

export class VetClinicRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateVetClinicInput): Promise<VetClinicProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO vet_clinic_profiles (id,workspace_id,tenant_id,clinic_name,vcnb_registration,cac_rc,clinic_type,status,created_at,updated_at) VALUES (?,?,?,?,NULL,NULL,?,'seeded',unixepoch(),unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clinicName, input.clinicType ?? 'companion').run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[vet-clinic] create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<VetClinicProfile | null> {
    const r = await this.db.prepare(`SELECT ${PC} FROM vet_clinic_profiles WHERE id=? AND tenant_id=?`).bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateVetClinicInput & { status?: VetClinicFSMState }): Promise<VetClinicProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.clinicName !== undefined) { sets.push('clinic_name=?'); b.push(input.clinicName); }
    if ('vcnbRegistration' in input) { sets.push('vcnb_registration=?'); b.push(input.vcnbRegistration ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc=?'); b.push(input.cacRc ?? null); }
    if (input.clinicType !== undefined) { sets.push('clinic_type=?'); b.push(input.clinicType); }
    if (input.status !== undefined) { sets.push('status=?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at=unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE vet_clinic_profiles SET ${sets.join(',')} WHERE id=? AND tenant_id=?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transition(id: string, tenantId: string, to: VetClinicFSMState): Promise<VetClinicProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createPatient(input: CreateVetPatientInput): Promise<VetPatient> {
    const id = input.id ?? crypto.randomUUID();
    const animalRef = input.animalRefId ?? crypto.randomUUID();
    const ownerRef = input.ownerRefId ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO vet_patients (id,profile_id,tenant_id,animal_ref_id,species,breed,owner_ref_id,age_months,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, animalRef, input.species, input.breed ?? null, ownerRef, input.ageMonths ?? null).run();
    const r = await this.db.prepare(`SELECT ${PAC} FROM vet_patients WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<PatientRow>();
    if (!r) throw new Error('[vet-clinic] create patient failed');
    return rowToPatient(r);
  }

  async listPatients(profileId: string, tenantId: string): Promise<VetPatient[]> {
    const { results } = await this.db.prepare(`SELECT ${PAC} FROM vet_patients WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<PatientRow>();
    return (results ?? []).map(rowToPatient);
  }

  async createAppointment(input: CreateVetAppointmentInput): Promise<VetAppointment> {
    if (!Number.isInteger(input.consultationFeeKobo) || input.consultationFeeKobo < 0) throw new Error('P9: consultationFeeKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO vet_appointments (id,profile_id,tenant_id,animal_ref_id,vet_id,appointment_time,appointment_type,consultation_fee_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'booked',unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, input.animalRefId, input.vetId, input.appointmentTime, input.appointmentType ?? 'consultation', input.consultationFeeKobo).run();
    const r = await this.db.prepare(`SELECT ${AC} FROM vet_appointments WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<ApptRow>();
    if (!r) throw new Error('[vet-clinic] create appointment failed');
    return rowToAppt(r);
  }

  async listAppointments(profileId: string, tenantId: string): Promise<VetAppointment[]> {
    const { results } = await this.db.prepare(`SELECT ${AC} FROM vet_appointments WHERE profile_id=? AND tenant_id=? ORDER BY appointment_time DESC`).bind(profileId, tenantId).all<ApptRow>();
    return (results ?? []).map(rowToAppt);
  }

  async createVaccination(input: CreateVetVaccinationInput): Promise<VetVaccination> {
    if (!Number.isInteger(input.costKobo) || input.costKobo < 0) throw new Error('P9: costKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    const now = input.dateAdministered ?? Math.floor(Date.now() / 1000);
    await this.db.prepare(`INSERT INTO vet_vaccinations (id,profile_id,tenant_id,animal_ref_id,vaccine_name,date_administered,next_due,cost_kobo,created_at) VALUES (?,?,?,?,?,?,?,?,unixepoch())`).bind(id, input.profileId, input.tenantId, input.animalRefId, input.vaccineName, now, input.nextDue ?? null, input.costKobo).run();
    const r = await this.db.prepare(`SELECT ${VC} FROM vet_vaccinations WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<VaccRow>();
    if (!r) throw new Error('[vet-clinic] create vaccination failed');
    return rowToVacc(r);
  }

  async createShopItem(input: CreateVetShopItemInput): Promise<VetShopInventoryItem> {
    if (!Number.isInteger(input.unitPriceKobo) || input.unitPriceKobo < 0) throw new Error('P9: unitPriceKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO vet_shop_inventory (id,profile_id,tenant_id,product_name,category,unit_price_kobo,quantity_in_stock,created_at,updated_at) VALUES (?,?,?,?,?,?,?,unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, input.productName, input.category ?? 'food', input.unitPriceKobo, input.quantityInStock ?? 0).run();
    const r = await this.db.prepare(`SELECT ${SC} FROM vet_shop_inventory WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<ShopRow>();
    if (!r) throw new Error('[vet-clinic] create shop item failed');
    return rowToShop(r);
  }

  async listShopItems(profileId: string, tenantId: string): Promise<VetShopInventoryItem[]> {
    const { results } = await this.db.prepare(`SELECT ${SC} FROM vet_shop_inventory WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<ShopRow>();
    return (results ?? []).map(rowToShop);
  }

  async aggregateStats(profileId: string, tenantId: string): Promise<{ totalAppointments: number; speciesBreakdown: Record<string, number> }> {
    const apptCount = await this.db.prepare(`SELECT COUNT(*) as cnt FROM vet_appointments WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).first<{ cnt: number }>();
    const speciesRows = await this.db.prepare(`SELECT species, COUNT(*) as cnt FROM vet_patients WHERE profile_id=? AND tenant_id=? GROUP BY species`).bind(profileId, tenantId).all<{ species: string; cnt: number }>();
    const speciesBreakdown: Record<string, number> = {};
    for (const row of (speciesRows.results ?? [])) { speciesBreakdown[row.species] = row.cnt; }
    return { totalAppointments: apptCount?.cnt ?? 0, speciesBreakdown };
  }
}
