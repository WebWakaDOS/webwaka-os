/**
 * POS Business — Customer CRM + loyalty points.
 * (M8b — Platform Invariants T3, P9, P13)
 *
 * T3: All queries scoped to tenantId.
 * P9: loyaltyPts always integers.
 * P13: phone stored but never logged to AI (callers must strip PII before AI calls).
 *
 * Migration: 0049_pos_business.sql (pos_customers table)
 */

import type {
  PosCustomer,
  CreateCustomerInput,
  UpdateCustomerInput,
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

interface CustomerRow {
  id: string;
  workspace_id: string;
  tenant_id: string;
  phone: string | null;
  name: string | null;
  loyalty_pts: number;
  created_at: number;
  updated_at: number;
}

function rowToCustomer(row: CustomerRow): PosCustomer {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    tenantId: row.tenant_id,
    phone: row.phone,
    name: row.name,
    loyaltyPts: row.loyalty_pts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CustomerRepository {
  private readonly db: D1Like;

  constructor(db: D1Like) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(input: CreateCustomerInput): Promise<PosCustomer> {
    const id = input.id ?? crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO pos_customers
           (id, workspace_id, tenant_id, phone, name, loyalty_pts,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, unixepoch(), unixepoch())`,
      )
      .bind(
        id,
        input.workspaceId,
        input.tenantId,
        input.phone ?? null,
        input.name ?? null,
      )
      .run();

    const customer = await this.findById(id, input.tenantId);
    if (!customer) throw new Error('[customers] Failed to create customer');
    return customer;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findById(id: string, tenantId: string): Promise<PosCustomer | null> {
    const row = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, phone, name, loyalty_pts,
                created_at, updated_at
         FROM pos_customers
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, tenantId)
      .first<CustomerRow>();

    return row ? rowToCustomer(row) : null;
  }

  async findByPhone(phone: string, tenantId: string): Promise<PosCustomer | null> {
    const row = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, phone, name, loyalty_pts,
                created_at, updated_at
         FROM pos_customers
         WHERE phone = ? AND tenant_id = ?`,
      )
      .bind(phone, tenantId)
      .first<CustomerRow>();

    return row ? rowToCustomer(row) : null;
  }

  async listByWorkspace(
    workspaceId: string,
    tenantId: string,
    limit = 50,
  ): Promise<PosCustomer[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, phone, name, loyalty_pts,
                created_at, updated_at
         FROM pos_customers
         WHERE workspace_id = ? AND tenant_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(workspaceId, tenantId, limit)
      .all<CustomerRow>();

    return (results ?? []).map(rowToCustomer);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    tenantId: string,
    input: UpdateCustomerInput,
  ): Promise<PosCustomer | null> {
    const setClauses: string[] = ['updated_at = unixepoch()'];
    const bindings: unknown[] = [];

    if ('phone' in input) {
      setClauses.push('phone = ?');
      bindings.push(input.phone ?? null);
    }
    if ('name' in input) {
      setClauses.push('name = ?');
      bindings.push(input.name ?? null);
    }

    bindings.push(id, tenantId);

    await this.db
      .prepare(
        `UPDATE pos_customers
         SET ${setClauses.join(', ')}
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(...bindings)
      .run();

    return this.findById(id, tenantId);
  }

  // ---------------------------------------------------------------------------
  // Loyalty points
  // ---------------------------------------------------------------------------

  async awardPoints(
    id: string,
    tenantId: string,
    points: number,
  ): Promise<PosCustomer | null> {
    if (!Number.isInteger(points) || points <= 0) {
      throw new Error('[customers] loyalty points must be a positive integer (P9)');
    }

    await this.db
      .prepare(
        `UPDATE pos_customers
         SET loyalty_pts = loyalty_pts + ?, updated_at = unixepoch()
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(points, id, tenantId)
      .run();

    return this.findById(id, tenantId);
  }

  async redeemPoints(
    id: string,
    tenantId: string,
    points: number,
  ): Promise<{ success: boolean; customer: PosCustomer | null }> {
    if (!Number.isInteger(points) || points <= 0) {
      throw new Error('[customers] loyalty points to redeem must be a positive integer (P9)');
    }

    const current = await this.findById(id, tenantId);
    if (!current || current.loyaltyPts < points) {
      return { success: false, customer: current };
    }

    await this.db
      .prepare(
        `UPDATE pos_customers
         SET loyalty_pts = loyalty_pts - ?, updated_at = unixepoch()
         WHERE id = ? AND tenant_id = ? AND loyalty_pts >= ?`,
      )
      .bind(points, id, tenantId, points)
      .run();

    return { success: true, customer: await this.findById(id, tenantId) };
  }
}
