import type {
  ClearingAgentProfile, CreateClearingAgentInput, UpdateClearingAgentInput,
  ClearingAgentFSMState, ClearingShipment, CreateShipmentInput, ShipmentStatus,
} from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, company_name, ncs_licence, nagaff_number, cac_rc, status, created_at, updated_at';
const SHIPMENT_COLS = 'id, profile_id, tenant_id, client_phone, vessel_name, bill_of_lading, container_number, cargo_description, declared_value_kobo, duty_amount_kobo, vat_kobo, port_charges_kobo, professional_fee_kobo, form_m_number, nafdac_permit_ref, port, status, created_at, updated_at';

function rowToProfile(r: Record<string, unknown>): ClearingAgentProfile {
  return {
    id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string,
    companyName: r['company_name'] as string, ncsLicence: r['ncs_licence'] as string | null,
    nagaffNumber: r['nagaff_number'] as string | null, cacRc: r['cac_rc'] as string | null,
    status: r['status'] as ClearingAgentFSMState,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

function rowToShipment(r: Record<string, unknown>): ClearingShipment {
  return {
    id: r['id'] as string, profileId: r['profile_id'] as string, tenantId: r['tenant_id'] as string,
    clientPhone: r['client_phone'] as string | null, vesselName: r['vessel_name'] as string | null,
    billOfLading: r['bill_of_lading'] as string | null, containerNumber: r['container_number'] as string | null,
    cargoDescription: r['cargo_description'] as string | null,
    declaredValueKobo: r['declared_value_kobo'] as number, dutyAmountKobo: r['duty_amount_kobo'] as number,
    vatKobo: r['vat_kobo'] as number, portChargesKobo: r['port_charges_kobo'] as number,
    professionalFeeKobo: r['professional_fee_kobo'] as number,
    formMNumber: r['form_m_number'] as string | null, nafdacPermitRef: r['nafdac_permit_ref'] as string | null,
    port: r['port'] as ClearingShipment['port'], status: r['status'] as ShipmentStatus,
    createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number,
  };
}

export class ClearingAgentRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateClearingAgentInput): Promise<ClearingAgentProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO clearing_agent_profiles (id, workspace_id, tenant_id, company_name, ncs_licence, nagaff_number, cac_rc, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.companyName, input.ncsLicence ?? null, input.nagaffNumber ?? null, input.cacRc ?? null).run();
    const p = await this.findProfileById(id, input.tenantId);
    if (!p) throw new Error('[clearing-agent] profile create failed');
    return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<ClearingAgentProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM clearing_agent_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<ClearingAgentProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM clearing_agent_profiles WHERE workspace_id = ? AND tenant_id = ? LIMIT 1`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateClearingAgentInput): Promise<ClearingAgentProfile | null> {
    const sets: string[] = []; const vals: unknown[] = [];
    if (input.companyName !== undefined) { sets.push('company_name = ?'); vals.push(input.companyName); }
    if (input.ncsLicence !== undefined) { sets.push('ncs_licence = ?'); vals.push(input.ncsLicence); }
    if (input.nagaffNumber !== undefined) { sets.push('nagaff_number = ?'); vals.push(input.nagaffNumber); }
    if (input.cacRc !== undefined) { sets.push('cac_rc = ?'); vals.push(input.cacRc); }
    if (input.status !== undefined) { sets.push('status = ?'); vals.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()');
    await this.db.prepare(`UPDATE clearing_agent_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...vals, id, tenantId).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionStatus(id: string, tenantId: string, to: ClearingAgentFSMState): Promise<ClearingAgentProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createShipment(input: CreateShipmentInput): Promise<ClearingShipment> {
    if (!Number.isInteger(input.declaredValueKobo) || input.declaredValueKobo < 0) throw new Error('[clearing-agent] declaredValueKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.dutyAmountKobo) || input.dutyAmountKobo < 0) throw new Error('[clearing-agent] dutyAmountKobo must be non-negative integer (P9)');
    if (!Number.isInteger(input.professionalFeeKobo) || input.professionalFeeKobo < 0) throw new Error('[clearing-agent] professionalFeeKobo must be non-negative integer (P9)');
    const vatKobo = input.vatKobo ?? 0;
    const portChargesKobo = input.portChargesKobo ?? 0;
    if (!Number.isInteger(vatKobo)) throw new Error('[clearing-agent] vatKobo must be integer (P9)');
    if (!Number.isInteger(portChargesKobo)) throw new Error('[clearing-agent] portChargesKobo must be integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO clearing_shipments (id, profile_id, tenant_id, client_phone, vessel_name, bill_of_lading, container_number, cargo_description, declared_value_kobo, duty_amount_kobo, vat_kobo, port_charges_kobo, professional_fee_kobo, form_m_number, nafdac_permit_ref, port, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'lodgement', unixepoch(), unixepoch())`).bind(id, input.profileId, input.tenantId, input.clientPhone ?? null, input.vesselName ?? null, input.billOfLading ?? null, input.containerNumber ?? null, input.cargoDescription ?? null, input.declaredValueKobo, input.dutyAmountKobo, vatKobo, portChargesKobo, input.professionalFeeKobo, input.formMNumber ?? null, input.nafdacPermitRef ?? null, input.port ?? 'apapa').run();
    const s = await this.findShipmentById(id, input.tenantId);
    if (!s) throw new Error('[clearing-agent] shipment create failed');
    return s;
  }

  async findShipmentById(id: string, tenantId: string): Promise<ClearingShipment | null> {
    const row = await this.db.prepare(`SELECT ${SHIPMENT_COLS} FROM clearing_shipments WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToShipment(row) : null;
  }

  async listShipments(profileId: string, tenantId: string): Promise<ClearingShipment[]> {
    const { results } = await this.db.prepare(`SELECT ${SHIPMENT_COLS} FROM clearing_shipments WHERE profile_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(profileId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToShipment);
  }

  async updateShipmentStatus(id: string, tenantId: string, status: ShipmentStatus): Promise<ClearingShipment | null> {
    await this.db.prepare(`UPDATE clearing_shipments SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findShipmentById(id, tenantId);
  }
}
