/**
 * Political Party D1 repository — scaffold.
 * (M8b — Platform Invariants T3)
 *
 * Migration: uses 0048_politician_profiles.sql schema basis.
 * Full migration will be 0050_political_party_profiles.sql (future).
 * For now, repository is scaffold — table will be added in next migration batch.
 *
 * T3: All queries scoped to tenantId.
 */

import type {
  PoliticalPartyProfile,
  PartyFSMState,
  CreatePartyInput,
  UpdatePartyInput,
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

interface PartyRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  tenant_id: string;
  party_name: string;
  abbreviation: string | null;
  cac_reg_number: string | null;
  inec_reg_number: string | null;
  chairperson_id: string | null;
  status: string;
  created_at: number;
}

function rowToParty(row: PartyRow): PoliticalPartyProfile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    tenantId: row.tenant_id,
    partyName: row.party_name,
    abbreviation: row.abbreviation,
    cacRegNumber: row.cac_reg_number,
    inecRegNumber: row.inec_reg_number,
    chairpersonId: row.chairperson_id,
    status: row.status as PartyFSMState,
    createdAt: row.created_at,
  };
}

export class PoliticalPartyRepository {
  private readonly db: D1Like;

  constructor(db: D1Like) {
    this.db = db;
  }

  async create(input: CreatePartyInput): Promise<PoliticalPartyProfile> {
    const id = input.id ?? crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO political_party_profiles
           (id, organization_id, workspace_id, tenant_id, party_name,
            abbreviation, cac_reg_number, inec_reg_number,
            chairperson_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'seeded', unixepoch())`,
      )
      .bind(
        id,
        input.organizationId,
        input.workspaceId,
        input.tenantId,
        input.partyName,
        input.abbreviation ?? null,
      )
      .run();

    const party = await this.findById(id, input.tenantId);
    if (!party) throw new Error('[political-party] Failed to create party profile');
    return party;
  }

  async findById(id: string, tenantId: string): Promise<PoliticalPartyProfile | null> {
    const row = await this.db
      .prepare(
        `SELECT id, organization_id, workspace_id, tenant_id, party_name,
                abbreviation, cac_reg_number, inec_reg_number,
                chairperson_id, status, created_at
         FROM political_party_profiles
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, tenantId)
      .first<PartyRow>();

    return row ? rowToParty(row) : null;
  }

  async findByWorkspace(workspaceId: string, tenantId: string): Promise<PoliticalPartyProfile[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, organization_id, workspace_id, tenant_id, party_name,
                abbreviation, cac_reg_number, inec_reg_number,
                chairperson_id, status, created_at
         FROM political_party_profiles
         WHERE workspace_id = ? AND tenant_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(workspaceId, tenantId)
      .all<PartyRow>();

    return (results ?? []).map(rowToParty);
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdatePartyInput,
  ): Promise<PoliticalPartyProfile | null> {
    const setClauses: string[] = [];
    const bindings: unknown[] = [];

    if (input.partyName !== undefined) {
      setClauses.push('party_name = ?');
      bindings.push(input.partyName);
    }
    if ('abbreviation' in input) {
      setClauses.push('abbreviation = ?');
      bindings.push(input.abbreviation ?? null);
    }
    if ('cacRegNumber' in input) {
      setClauses.push('cac_reg_number = ?');
      bindings.push(input.cacRegNumber ?? null);
    }
    if ('inecRegNumber' in input) {
      setClauses.push('inec_reg_number = ?');
      bindings.push(input.inecRegNumber ?? null);
    }
    if ('chairpersonId' in input) {
      setClauses.push('chairperson_id = ?');
      bindings.push(input.chairpersonId ?? null);
    }
    if (input.status !== undefined) {
      setClauses.push('status = ?');
      bindings.push(input.status);
    }

    if (setClauses.length === 0) return this.findById(id, tenantId);

    bindings.push(id, tenantId);

    await this.db
      .prepare(
        `UPDATE political_party_profiles
         SET ${setClauses.join(', ')}
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(...bindings)
      .run();

    return this.findById(id, tenantId);
  }

  async transition(
    id: string,
    tenantId: string,
    toStatus: PartyFSMState,
  ): Promise<PoliticalPartyProfile | null> {
    return this.update(id, tenantId, { status: toStatus });
  }
}
