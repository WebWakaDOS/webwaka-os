/**
 * Politician profile D1 repository.
 * (M8b — Platform Invariants T3, P9)
 *
 * ALL queries are scoped by tenantId (T3).
 * No cross-tenant reads are possible via this repository.
 *
 * Migration: 0048_politician_profiles.sql
 */

import type {
  PoliticianProfile,
  PoliticianFSMState,
  OfficeType,
  CreatePoliticianInput,
  UpdatePoliticianInput,
} from './types.js';

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

interface PoliticianRow {
  id: string;
  individual_id: string;
  workspace_id: string;
  tenant_id: string;
  office_type: string;
  jurisdiction_id: string;
  party_id: string | null;
  nin_verified: number;
  inec_filing_ref: string | null;
  term_start: number | null;
  term_end: number | null;
  status: string;
  created_at: number;
}

function rowToProfile(row: PoliticianRow): PoliticianProfile {
  return {
    id: row.id,
    individualId: row.individual_id,
    workspaceId: row.workspace_id,
    tenantId: row.tenant_id,
    officeType: row.office_type as OfficeType,
    jurisdictionId: row.jurisdiction_id,
    partyId: row.party_id,
    ninVerified: row.nin_verified === 1,
    inecFilingRef: row.inec_filing_ref,
    termStart: row.term_start,
    termEnd: row.term_end,
    status: row.status as PoliticianFSMState,
    createdAt: row.created_at,
  };
}

export class PoliticianRepository {
  private readonly db: D1Like;

  constructor(db: D1Like) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(input: CreatePoliticianInput): Promise<PoliticianProfile> {
    const id = input.id ?? crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO politician_profiles
           (id, individual_id, workspace_id, tenant_id, office_type,
            jurisdiction_id, party_id, nin_verified, inec_filing_ref,
            term_start, term_end, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, 'seeded', unixepoch())`,
      )
      .bind(
        id,
        input.individualId,
        input.workspaceId,
        input.tenantId,
        input.officeType,
        input.jurisdictionId,
        input.partyId ?? null,
      )
      .run();

    const profile = await this.findById(id, input.tenantId);
    if (!profile) throw new Error('[politician] Failed to create profile');
    return profile;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findById(id: string, tenantId: string): Promise<PoliticianProfile | null> {
    const row = await this.db
      .prepare(
        `SELECT id, individual_id, workspace_id, tenant_id, office_type,
                jurisdiction_id, party_id, nin_verified, inec_filing_ref,
                term_start, term_end, status, created_at
         FROM politician_profiles
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, tenantId)
      .first<PoliticianRow>();

    return row ? rowToProfile(row) : null;
  }

  async findByWorkspace(
    workspaceId: string,
    tenantId: string,
  ): Promise<PoliticianProfile[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, individual_id, workspace_id, tenant_id, office_type,
                jurisdiction_id, party_id, nin_verified, inec_filing_ref,
                term_start, term_end, status, created_at
         FROM politician_profiles
         WHERE workspace_id = ? AND tenant_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(workspaceId, tenantId)
      .all<PoliticianRow>();

    return (results ?? []).map(rowToProfile);
  }

  async findByOfficeType(
    officeType: OfficeType,
    tenantId: string,
  ): Promise<PoliticianProfile[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, individual_id, workspace_id, tenant_id, office_type,
                jurisdiction_id, party_id, nin_verified, inec_filing_ref,
                term_start, term_end, status, created_at
         FROM politician_profiles
         WHERE office_type = ? AND tenant_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(officeType, tenantId)
      .all<PoliticianRow>();

    return (results ?? []).map(rowToProfile);
  }

  async findByStatus(
    status: PoliticianFSMState,
    tenantId: string,
  ): Promise<PoliticianProfile[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, individual_id, workspace_id, tenant_id, office_type,
                jurisdiction_id, party_id, nin_verified, inec_filing_ref,
                term_start, term_end, status, created_at
         FROM politician_profiles
         WHERE status = ? AND tenant_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(status, tenantId)
      .all<PoliticianRow>();

    return (results ?? []).map(rowToProfile);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    tenantId: string,
    input: UpdatePoliticianInput,
  ): Promise<PoliticianProfile | null> {
    const setClauses: string[] = [];
    const bindings: unknown[] = [];

    if (input.officeType !== undefined) {
      setClauses.push('office_type = ?');
      bindings.push(input.officeType);
    }
    if (input.jurisdictionId !== undefined) {
      setClauses.push('jurisdiction_id = ?');
      bindings.push(input.jurisdictionId);
    }
    if ('partyId' in input) {
      setClauses.push('party_id = ?');
      bindings.push(input.partyId ?? null);
    }
    if (input.ninVerified !== undefined) {
      setClauses.push('nin_verified = ?');
      bindings.push(input.ninVerified ? 1 : 0);
    }
    if ('inecFilingRef' in input) {
      setClauses.push('inec_filing_ref = ?');
      bindings.push(input.inecFilingRef ?? null);
    }
    if ('termStart' in input) {
      setClauses.push('term_start = ?');
      bindings.push(input.termStart ?? null);
    }
    if ('termEnd' in input) {
      setClauses.push('term_end = ?');
      bindings.push(input.termEnd ?? null);
    }
    if (input.status !== undefined) {
      setClauses.push('status = ?');
      bindings.push(input.status);
    }

    if (setClauses.length === 0) return this.findById(id, tenantId);

    bindings.push(id, tenantId);

    await this.db
      .prepare(
        `UPDATE politician_profiles
         SET ${setClauses.join(', ')}
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(...bindings)
      .run();

    return this.findById(id, tenantId);
  }

  // ---------------------------------------------------------------------------
  // FSM transition (T3 — tenantId always in WHERE)
  // ---------------------------------------------------------------------------

  async transition(
    id: string,
    tenantId: string,
    toStatus: PoliticianFSMState,
  ): Promise<PoliticianProfile | null> {
    return this.update(id, tenantId, { status: toStatus });
  }

  // ---------------------------------------------------------------------------
  // Delete (hard — admin only)
  // ---------------------------------------------------------------------------

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        'DELETE FROM politician_profiles WHERE id = ? AND tenant_id = ?',
      )
      .bind(id, tenantId)
      .run();
    return result.success;
  }
}
