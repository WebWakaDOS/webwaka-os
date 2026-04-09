import type { SpaProfile, CreateSpaInput, UpdateSpaInput, SpaFSMState, SpaService, CreateSpaServiceInput, SpaAppointment, CreateSpaAppointmentInput, AppointmentStatus, SpaMembership, CreateSpaMembershipInput } from './types.js';

interface D1Like { prepare(s: string): { bind(...v: unknown[]): { run(): Promise<{ success: boolean }>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }; }; }

const PROFILE_COLS = 'id, workspace_id, tenant_id, spa_name, type, nasc_number, state_health_permit, status, created_at, updated_at';
function rowToProfile(r: Record<string, unknown>): SpaProfile {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, spaName: r['spa_name'] as string, type: r['type'] as SpaProfile['type'], nascNumber: r['nasc_number'] as string | null, stateHealthPermit: r['state_health_permit'] as string | null, status: r['status'] as SpaFSMState, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const SERVICE_COLS = 'id, workspace_id, tenant_id, service_name, category, duration_minutes, price_kobo, created_at, updated_at';
function rowToService(r: Record<string, unknown>): SpaService {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, serviceName: r['service_name'] as string, category: r['category'] as SpaService['category'], durationMinutes: r['duration_minutes'] as number, priceKobo: r['price_kobo'] as number, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const APPT_COLS = 'id, workspace_id, tenant_id, client_phone, service_id, therapist_id, room_number, appointment_time, status, deposit_kobo, created_at, updated_at';
function rowToAppointment(r: Record<string, unknown>): SpaAppointment {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, clientPhone: r['client_phone'] as string, serviceId: r['service_id'] as string, therapistId: r['therapist_id'] as string | null, roomNumber: r['room_number'] as string | null, appointmentTime: r['appointment_time'] as number, status: r['status'] as AppointmentStatus, depositKobo: r['deposit_kobo'] as number, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

const MEMBERSHIP_COLS = 'id, workspace_id, tenant_id, client_phone, package_name, monthly_fee_kobo, sessions_per_month, sessions_used, valid_until, created_at, updated_at';
function rowToMembership(r: Record<string, unknown>): SpaMembership {
  return { id: r['id'] as string, workspaceId: r['workspace_id'] as string, tenantId: r['tenant_id'] as string, clientPhone: r['client_phone'] as string, packageName: r['package_name'] as string, monthlyFeeKobo: r['monthly_fee_kobo'] as number, sessionsPerMonth: r['sessions_per_month'] as number, sessionsUsed: r['sessions_used'] as number, validUntil: r['valid_until'] as number | null, createdAt: r['created_at'] as number, updatedAt: r['updated_at'] as number };
}

export class SpaRepository {
  constructor(private readonly db: D1Like) {}

  async createProfile(input: CreateSpaInput): Promise<SpaProfile> {
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO spa_profiles (id, workspace_id, tenant_id, spa_name, type, nasc_number, state_health_permit, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seeded', unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.spaName, input.type, input.nascNumber ?? null, input.stateHealthPermit ?? null).run();
    const p = await this.findProfileById(id, input.tenantId); if (!p) throw new Error('[spa] profile create failed'); return p;
  }

  async findProfileById(id: string, tenantId: string): Promise<SpaProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM spa_profiles WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async findProfileByWorkspace(workspaceId: string, tenantId: string): Promise<SpaProfile | null> {
    const row = await this.db.prepare(`SELECT ${PROFILE_COLS} FROM spa_profiles WHERE workspace_id = ? AND tenant_id = ?`).bind(workspaceId, tenantId).first<Record<string, unknown>>();
    return row ? rowToProfile(row) : null;
  }

  async updateProfile(id: string, tenantId: string, input: UpdateSpaInput): Promise<SpaProfile | null> {
    const sets: string[] = []; const b: unknown[] = [];
    if (input.spaName !== undefined) { sets.push('spa_name = ?'); b.push(input.spaName); }
    if (input.type !== undefined) { sets.push('type = ?'); b.push(input.type); }
    if ('nascNumber' in input) { sets.push('nasc_number = ?'); b.push(input.nascNumber ?? null); }
    if ('stateHealthPermit' in input) { sets.push('state_health_permit = ?'); b.push(input.stateHealthPermit ?? null); }
    if (input.status !== undefined) { sets.push('status = ?'); b.push(input.status); }
    if (sets.length === 0) return this.findProfileById(id, tenantId);
    sets.push('updated_at = unixepoch()'); b.push(id, tenantId);
    await this.db.prepare(`UPDATE spa_profiles SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...b).run();
    return this.findProfileById(id, tenantId);
  }

  async transitionProfile(id: string, tenantId: string, to: SpaFSMState): Promise<SpaProfile | null> {
    return this.updateProfile(id, tenantId, { status: to });
  }

  async createService(input: CreateSpaServiceInput): Promise<SpaService> {
    if (!Number.isInteger(input.priceKobo) || input.priceKobo <= 0) throw new Error('[spa] priceKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO spa_services (id, workspace_id, tenant_id, service_name, category, duration_minutes, price_kobo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.serviceName, input.category ?? 'massage', input.durationMinutes ?? 60, input.priceKobo).run();
    const s = await this.findServiceById(id, input.tenantId); if (!s) throw new Error('[spa] service create failed'); return s;
  }

  async findServiceById(id: string, tenantId: string): Promise<SpaService | null> {
    const row = await this.db.prepare(`SELECT ${SERVICE_COLS} FROM spa_services WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToService(row) : null;
  }

  async listServices(workspaceId: string, tenantId: string): Promise<SpaService[]> {
    const { results } = await this.db.prepare(`SELECT ${SERVICE_COLS} FROM spa_services WHERE workspace_id = ? AND tenant_id = ? ORDER BY category, service_name`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToService);
  }

  async createAppointment(input: CreateSpaAppointmentInput): Promise<SpaAppointment> {
    if (!Number.isInteger(input.depositKobo ?? 0) || (input.depositKobo ?? 0) < 0) throw new Error('[spa] depositKobo must be non-negative integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO spa_appointments (id, workspace_id, tenant_id, client_phone, service_id, therapist_id, room_number, appointment_time, status, deposit_kobo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'booked', ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clientPhone, input.serviceId, input.therapistId ?? null, input.roomNumber ?? null, input.appointmentTime, input.depositKobo ?? 0).run();
    const a = await this.findAppointmentById(id, input.tenantId); if (!a) throw new Error('[spa] appointment create failed'); return a;
  }

  async findAppointmentById(id: string, tenantId: string): Promise<SpaAppointment | null> {
    const row = await this.db.prepare(`SELECT ${APPT_COLS} FROM spa_appointments WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToAppointment(row) : null;
  }

  async listAppointments(workspaceId: string, tenantId: string): Promise<SpaAppointment[]> {
    const { results } = await this.db.prepare(`SELECT ${APPT_COLS} FROM spa_appointments WHERE workspace_id = ? AND tenant_id = ? ORDER BY appointment_time ASC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToAppointment);
  }

  async updateAppointmentStatus(id: string, tenantId: string, status: AppointmentStatus): Promise<SpaAppointment | null> {
    await this.db.prepare(`UPDATE spa_appointments SET status = ?, updated_at = unixepoch() WHERE id = ? AND tenant_id = ?`).bind(status, id, tenantId).run();
    return this.findAppointmentById(id, tenantId);
  }

  async createMembership(input: CreateSpaMembershipInput): Promise<SpaMembership> {
    if (!Number.isInteger(input.monthlyFeeKobo) || input.monthlyFeeKobo <= 0) throw new Error('[spa] monthlyFeeKobo must be positive integer (P9)');
    const id = input.id ?? crypto.randomUUID();
    await this.db.prepare(`INSERT INTO spa_memberships (id, workspace_id, tenant_id, client_phone, package_name, monthly_fee_kobo, sessions_per_month, sessions_used, valid_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, unixepoch(), unixepoch())`).bind(id, input.workspaceId, input.tenantId, input.clientPhone, input.packageName, input.monthlyFeeKobo, input.sessionsPerMonth ?? 4, input.validUntil ?? null).run();
    const m = await this.findMembershipById(id, input.tenantId); if (!m) throw new Error('[spa] membership create failed'); return m;
  }

  async findMembershipById(id: string, tenantId: string): Promise<SpaMembership | null> {
    const row = await this.db.prepare(`SELECT ${MEMBERSHIP_COLS} FROM spa_memberships WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<Record<string, unknown>>();
    return row ? rowToMembership(row) : null;
  }

  async listMemberships(workspaceId: string, tenantId: string): Promise<SpaMembership[]> {
    const { results } = await this.db.prepare(`SELECT ${MEMBERSHIP_COLS} FROM spa_memberships WHERE workspace_id = ? AND tenant_id = ? ORDER BY created_at DESC`).bind(workspaceId, tenantId).all<Record<string, unknown>>();
    return (results ?? []).map(rowToMembership);
  }
}
