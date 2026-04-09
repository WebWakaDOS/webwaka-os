/**
 * POS Business — Product catalog + inventory management.
 * (M8b — Platform Invariants T3, P9)
 *
 * T3: All queries scoped to tenantId.
 * P9: priceKobo and stockQty are always integers.
 *
 * Migration: 0049_pos_business.sql (pos_products table)
 */

import type {
  PosProduct,
  CreateProductInput,
  UpdateProductInput,
  StockAdjustment,
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

interface ProductRow {
  id: string;
  workspace_id: string;
  tenant_id: string;
  name: string;
  sku: string | null;
  price_kobo: number;
  stock_qty: number;
  category: string | null;
  active: number;
  created_at: number;
  updated_at: number;
}

function rowToProduct(row: ProductRow): PosProduct {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    tenantId: row.tenant_id,
    name: row.name,
    sku: row.sku,
    priceKobo: row.price_kobo,
    stockQty: row.stock_qty,
    category: row.category,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class InventoryRepository {
  private readonly db: D1Like;

  constructor(db: D1Like) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(input: CreateProductInput): Promise<PosProduct> {
    if (!Number.isInteger(input.priceKobo) || input.priceKobo < 0) {
      throw new Error('[inventory] priceKobo must be a non-negative integer (P9)');
    }

    const id = input.id ?? crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO pos_products
           (id, workspace_id, tenant_id, name, sku, price_kobo, stock_qty,
            category, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())`,
      )
      .bind(
        id,
        input.workspaceId,
        input.tenantId,
        input.name,
        input.sku ?? null,
        input.priceKobo,
        input.stockQty ?? 0,
        input.category ?? null,
      )
      .run();

    const product = await this.findById(id, input.tenantId);
    if (!product) throw new Error('[inventory] Failed to create product');
    return product;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findById(id: string, tenantId: string): Promise<PosProduct | null> {
    const row = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, name, sku, price_kobo, stock_qty,
                category, active, created_at, updated_at
         FROM pos_products
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, tenantId)
      .first<ProductRow>();

    return row ? rowToProduct(row) : null;
  }

  async findByWorkspace(
    workspaceId: string,
    tenantId: string,
    activeOnly = true,
  ): Promise<PosProduct[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, name, sku, price_kobo, stock_qty,
                category, active, created_at, updated_at
         FROM pos_products
         WHERE workspace_id = ? AND tenant_id = ?${activeOnly ? ' AND active = 1' : ''}
         ORDER BY name ASC`,
      )
      .bind(workspaceId, tenantId)
      .all<ProductRow>();

    return (results ?? []).map(rowToProduct);
  }

  async findLowStock(workspaceId: string, tenantId: string, threshold = 5): Promise<PosProduct[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, name, sku, price_kobo, stock_qty,
                category, active, created_at, updated_at
         FROM pos_products
         WHERE workspace_id = ? AND tenant_id = ? AND active = 1 AND stock_qty <= ?
         ORDER BY stock_qty ASC`,
      )
      .bind(workspaceId, tenantId, threshold)
      .all<ProductRow>();

    return (results ?? []).map(rowToProduct);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    tenantId: string,
    input: UpdateProductInput,
  ): Promise<PosProduct | null> {
    const setClauses: string[] = ['updated_at = unixepoch()'];
    const bindings: unknown[] = [];

    if (input.name !== undefined) {
      setClauses.push('name = ?');
      bindings.push(input.name);
    }
    if ('sku' in input) {
      setClauses.push('sku = ?');
      bindings.push(input.sku ?? null);
    }
    if (input.priceKobo !== undefined) {
      if (!Number.isInteger(input.priceKobo) || input.priceKobo < 0) {
        throw new Error('[inventory] priceKobo must be a non-negative integer (P9)');
      }
      setClauses.push('price_kobo = ?');
      bindings.push(input.priceKobo);
    }
    if (input.stockQty !== undefined) {
      setClauses.push('stock_qty = ?');
      bindings.push(input.stockQty);
    }
    if ('category' in input) {
      setClauses.push('category = ?');
      bindings.push(input.category ?? null);
    }
    if (input.active !== undefined) {
      setClauses.push('active = ?');
      bindings.push(input.active ? 1 : 0);
    }

    bindings.push(id, tenantId);

    await this.db
      .prepare(
        `UPDATE pos_products
         SET ${setClauses.join(', ')}
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(...bindings)
      .run();

    return this.findById(id, tenantId);
  }

  async adjustStock(
    id: string,
    tenantId: string,
    adjustment: StockAdjustment,
  ): Promise<PosProduct | null> {
    if (!Number.isInteger(adjustment.delta)) {
      throw new Error('[inventory] stock delta must be an integer (P9)');
    }

    await this.db
      .prepare(
        `UPDATE pos_products
         SET stock_qty = MAX(0, stock_qty + ?), updated_at = unixepoch()
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(adjustment.delta, id, tenantId)
      .run();

    return this.findById(id, tenantId);
  }

  // ---------------------------------------------------------------------------
  // Deactivate (soft delete)
  // ---------------------------------------------------------------------------

  async deactivate(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        `UPDATE pos_products
         SET active = 0, updated_at = unixepoch()
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, tenantId)
      .run();
    return result.success;
  }
}
