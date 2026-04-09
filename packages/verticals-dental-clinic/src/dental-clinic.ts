/**
 * DentalClinicRepository — M9
 * T3: all queries scoped to tenantId
 * P9: consultation_fee_kobo / treatment_cost_kobo are integers
 * P13: patient_ref_id is opaque UUID — no clinical content stored
 */

import type {
  DentalClinicProfile, DentalDentist, DentalAppointment, DentalTreatment,
  DentalClinicFSMState,
  CreateDentalClinicInput, UpdateDentalClinicInput,
  CreateDentistInput, CreateAppointmentInput, CreateTreatmentInput,
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

interface ProfileRow {
  id: string; workspace_id: string; tenant_id: string; clinic_name: string;
  mdcn_facility_reg: string | null; adsn_membership: string | null; cac_rc: string | null;
  status: string; created_at: number; updated_at: number;
}
interface DentistRow {
  id: string; profile_id: string; tenant_id: string; dentist_ref_id: string;
  mdcn_reg_number: string; specialisation: string | null; status: string;
  created_at: number; updated_at: number;
}
interface AppointmentRow {
  id: string; profile_id: string; tenant_id: string; patient_ref_id: string;
  dentist_ref_id: string; appointment_time: number; treatment_type: string;
  consultation_fee_kobo: number; status: string; created_at: number; updated_at: number;
}
interface TreatmentRow {
  id: string; profile_id: string; appointment_id: string; tenant_id: string;
  treatment_cost_kobo: number; lab_ref: string | null; notes_ref: string | null;
  created_at: number; updated_at: number;
}

function rowToProfile(r: ProfileRow): DentalClinicProfile {
  return { id: r.id, workspaceId: r.workspace_id, tenantId: r.tenant_id, clinicName: r.clinic_name,
    mdcnFacilityReg: r.mdcn_facility_reg, adsnMembership: r.adsn_membership, cacRc: r.cac_rc,
    status: r.status as DentalClinicFSMState, createdAt: r.created_at, updatedAt: r.updated_at };
}
function rowToDentist(r: DentistRow): DentalDentist {
  return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, dentistRefId: r.dentist_ref_id,
    mdcnRegNumber: r.mdcn_reg_number, specialisation: r.specialisation, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at };
}
function rowToAppointment(r: AppointmentRow): DentalAppointment {
  return { id: r.id, profileId: r.profile_id, tenantId: r.tenant_id, patientRefId: r.patient_ref_id,
    dentistRefId: r.dentist_ref_id, appointmentTime: r.appointment_time,
    treatmentType: r.treatment_type as DentalAppointment['treatmentType'],
    consultationFeeKobo: r.consultation_fee_kobo, status: r.status as DentalAppointment['status'],
    createdAt: r.created_at, updatedAt: r.updated_at };
}
function rowToTreatment(r: TreatmentRow): DentalTreatment {
  return { id: r.id, profileId: r.profile_id, appointmentId: r.appointment_id, tenantId: r.tenant_id,
    treatmentCostKobo: r.treatment_cost_kobo, labRef: r.lab_ref, notesRef: r.notes_ref,
    createdAt: r.created_at, updatedAt: r.updated_at };
}

const PCOLS = 'id,workspace_id,tenant_id,clinic_name,mdcn_facility_reg,adsn_membership,cac_rc,status,created_at,updated_at';
const DCOLS = 'id,profile_id,tenant_id,dentist_ref_id,mdcn_reg_number,specialisation,status,created_at,updated_at';
const ACOLS = 'id,profile_id,tenant_id,patient_ref_id,dentist_ref_id,appointment_time,treatment_type,consultation_fee_kobo,status,created_at,updated_at';
const TCOLS = 'id,profile_id,appointment_id,tenant_id,treatment_cost_kobo,lab_ref,notes_ref,created_at,updated_at';

export class DentalClinicRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateDentalClinicInput): Promise<DentalClinicProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO dental_clinic_profiles (id,workspace_id,tenant_id,clinic_name,mdcn_facility_reg,adsn_membership,cac_rc,status,created_at,updated_at) VALUES (?,?,?,?,NULL,NULL,NULL,'seeded',unixepoch(),unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clinicName).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[dental-clinic] create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<DentalClinicProfile | null> {
    const r = await this.db.prepare(`SELECT ${PCOLS} FROM dental_clinic_profiles WHERE id=? AND tenant_id=?`).bind(id, tenantId).first<ProfileRow>();
    return r ? rowToProfile(r) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateDentalClinicInput & { status?: DentalClinicFSMState }): Promise<DentalClinicProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.clinicName !== undefined) { sets.push('clinic_name=?'); b.push(input.clinicName); }
    if ('mdcnFacilityReg' in input) { sets.push('mdcn_facility_reg=?'); b.push(input.mdcnFacilityReg ?? null); }
    if ('adsnMembership' in input) { sets.push('adsn_membership=?'); b.push(input.adsnMembership ?? null); }
    if ('cacRc' in input) { sets.push('cac_rc=?'); b.push(input.cacRc ?? null); }
    if (input.status !== undefined) { sets.push('status=?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at=unixepoch()');
    b.push(id, tenantId);
    await this.db.prepare(`UPDATE dental_clinic_profiles SET ${sets.join(',')} WHERE id=? AND tenant_id=?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transition(id: string, tenantId: string, to: DentalClinicFSMState): Promise<DentalClinicProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createDentist(input: CreateDentistInput): Promise<DentalDentist> {
    const id = input.id ?? crypto.randomUUID();
    const ref = crypto.randomUUID();
    await this.db.prepare(`INSERT INTO dental_dentists (id,profile_id,tenant_id,dentist_ref_id,mdcn_reg_number,specialisation,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'active',unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, ref, input.mdcnRegNumber, input.specialisation ?? null).run();
    const r = await this.db.prepare(`SELECT ${DCOLS} FROM dental_dentists WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<DentistRow>();
    if (!r) throw new Error('[dental-clinic] create dentist failed');
    return rowToDentist(r);
  }

  async listDentists(profileId: string, tenantId: string): Promise<DentalDentist[]> {
    const { results } = await this.db.prepare(`SELECT ${DCOLS} FROM dental_dentists WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<DentistRow>();
    return (results ?? []).map(rowToDentist);
  }

  async createAppointment(input: CreateAppointmentInput): Promise<DentalAppointment> {
    if (!Number.isInteger(input.consultationFeeKobo) || input.consultationFeeKobo < 0) throw new Error('P9: consultationFeeKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    const patientRef = input.patientRefId ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO dental_appointments (id,profile_id,tenant_id,patient_ref_id,dentist_ref_id,appointment_time,treatment_type,consultation_fee_kobo,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'booked',unixepoch(),unixepoch())`).bind(id, input.profileId, input.tenantId, patientRef, input.dentistRefId, input.appointmentTime, input.treatmentType ?? 'consultation', input.consultationFeeKobo).run();
    const r = await this.db.prepare(`SELECT ${ACOLS} FROM dental_appointments WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<AppointmentRow>();
    if (!r) throw new Error('[dental-clinic] create appointment failed');
    return rowToAppointment(r);
  }

  async listAppointments(profileId: string, tenantId: string): Promise<DentalAppointment[]> {
    const { results } = await this.db.prepare(`SELECT ${ACOLS} FROM dental_appointments WHERE profile_id=? AND tenant_id=? ORDER BY appointment_time DESC`).bind(profileId, tenantId).all<AppointmentRow>();
    return (results ?? []).map(rowToAppointment);
  }

  async createTreatment(input: CreateTreatmentInput): Promise<DentalTreatment> {
    if (!Number.isInteger(input.treatmentCostKobo) || input.treatmentCostKobo < 0) throw new Error('P9: treatmentCostKobo must be a non-negative integer');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO dental_treatments (id,profile_id,appointment_id,tenant_id,treatment_cost_kobo,lab_ref,notes_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,unixepoch(),unixepoch())`).bind(id, input.profileId, input.appointmentId, input.tenantId, input.treatmentCostKobo, input.labRef ?? null, input.notesRef ?? null).run();
    const r = await this.db.prepare(`SELECT ${TCOLS} FROM dental_treatments WHERE id=? AND tenant_id=?`).bind(id, input.tenantId).first<TreatmentRow>();
    if (!r) throw new Error('[dental-clinic] create treatment failed');
    return rowToTreatment(r);
  }

  async listTreatments(profileId: string, tenantId: string): Promise<DentalTreatment[]> {
    const { results } = await this.db.prepare(`SELECT ${TCOLS} FROM dental_treatments WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).all<TreatmentRow>();
    return (results ?? []).map(rowToTreatment);
  }

  async aggregateStats(profileId: string, tenantId: string): Promise<{ totalAppointments: number; totalRevenueKobo: number }> {
    const r = await this.db.prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(consultation_fee_kobo),0) as rev FROM dental_appointments WHERE profile_id=? AND tenant_id=?`).bind(profileId, tenantId).first<{ cnt: number; rev: number }>();
    return { totalAppointments: r?.cnt ?? 0, totalRevenueKobo: r?.rev ?? 0 };
  }
}
