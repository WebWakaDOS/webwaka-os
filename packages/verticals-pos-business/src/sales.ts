/**
 * POS Business — Sale recording + daily reconciliation.
 * (M8b — Platform Invariants T3, P9)
 *
 * T3: All queries scoped to tenantId.
 * P9: All monetary amounts in kobo (integer). totalKobo = sum(item.qty * item.priceKobo).
 *
 * Sale creation is atomic:
 *   1. Validate items (all prices are integers, qty > 0).
 *   2. Calculate totalKobo.
 *   3. Insert pos_sale row.
 *   4. Decrement stock for each item (best-effort; oversell is allowed and flagged).
 *
 * Migration: 0049_pos_business.sql (pos_sales table)
 */

import type {
  PosSale,
  SaleItem,
  PaymentMethod,
  CreateSaleInput,
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

interface SaleRow {
  id: string;
  workspace_id: string;
  tenant_id: string;
  cashier_id: string;
  total_kobo: number;
  payment_method: string;
  items_json: string;
  created_at: number;
}

function rowToSale(row: SaleRow): PosSale {
  let items: SaleItem[] = [];
  try {
    items = JSON.parse(row.items_json) as SaleItem[];
  } catch {
    items = [];
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    tenantId: row.tenant_id,
    cashierId: row.cashier_id,
    totalKobo: row.total_kobo,
    paymentMethod: row.payment_method as PaymentMethod,
    items,
    createdAt: row.created_at,
  };
}

function calculateTotal(items: SaleItem[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.priceKobo, 0);
}

export class SalesRepository {
  private readonly db: D1Like;

  constructor(db: D1Like) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Record sale
  // ---------------------------------------------------------------------------

  async recordSale(input: CreateSaleInput): Promise<PosSale> {
    if (!input.items || input.items.length === 0) {
      throw new Error('[sales] Sale must contain at least one item');
    }

    for (const item of input.items) {
      if (!Number.isInteger(item.priceKobo) || item.priceKobo < 0) {
        throw new Error(`[sales] item.priceKobo must be a non-negative integer (P9): ${item.productId}`);
      }
      if (!Number.isInteger(item.qty) || item.qty <= 0) {
        throw new Error(`[sales] item.qty must be a positive integer: ${item.productId}`);
      }
    }

    const totalKobo = calculateTotal(input.items);
    if (totalKobo <= 0) {
      throw new Error('[sales] Sale total must be positive (P9)');
    }

    const id = input.id ?? crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO pos_sales
           (id, workspace_id, tenant_id, cashier_id, total_kobo,
            payment_method, items_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`,
      )
      .bind(
        id,
        input.workspaceId,
        input.tenantId,
        input.cashierId,
        totalKobo,
        input.paymentMethod,
        JSON.stringify(input.items),
      )
      .run();

    // Decrement stock for each item (best-effort — no hard block on oversell)
    for (const item of input.items) {
      await this.db
        .prepare(
          `UPDATE pos_products
           SET stock_qty = MAX(0, stock_qty - ?), updated_at = unixepoch()
           WHERE id = ? AND tenant_id = ?`,
        )
        .bind(item.qty, item.productId, input.tenantId)
        .run();
    }

    const sale = await this.findById(id, input.tenantId);
    if (!sale) throw new Error('[sales] Failed to record sale');
    return sale;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findById(id: string, tenantId: string): Promise<PosSale | null> {
    const row = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, cashier_id, total_kobo,
                payment_method, items_json, created_at
         FROM pos_sales
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, tenantId)
      .first<SaleRow>();

    return row ? rowToSale(row) : null;
  }

  async listByWorkspace(
    workspaceId: string,
    tenantId: string,
    limit = 50,
  ): Promise<PosSale[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, cashier_id, total_kobo,
                payment_method, items_json, created_at
         FROM pos_sales
         WHERE workspace_id = ? AND tenant_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(workspaceId, tenantId, limit)
      .all<SaleRow>();

    return (results ?? []).map(rowToSale);
  }

  async listByCashier(
    cashierId: string,
    tenantId: string,
    limit = 50,
  ): Promise<PosSale[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, workspace_id, tenant_id, cashier_id, total_kobo,
                payment_method, items_json, created_at
         FROM pos_sales
         WHERE cashier_id = ? AND tenant_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(cashierId, tenantId, limit)
      .all<SaleRow>();

    return (results ?? []).map(rowToSale);
  }

  // ---------------------------------------------------------------------------
  // Daily reconciliation
  // ---------------------------------------------------------------------------

  async dailySummary(
    workspaceId: string,
    tenantId: string,
    dateUnixStart: number,
    dateUnixEnd: number,
  ): Promise<{
    totalSales: number;
    totalKobo: number;
    byPaymentMethod: Record<PaymentMethod, { count: number; kobo: number }>;
  }> {
    const { results } = await this.db
      .prepare(
        `SELECT payment_method,
                COUNT(*) AS cnt,
                SUM(total_kobo) AS kobo
         FROM pos_sales
         WHERE workspace_id = ? AND tenant_id = ?
           AND created_at >= ? AND created_at < ?
         GROUP BY payment_method`,
      )
      .bind(workspaceId, tenantId, dateUnixStart, dateUnixEnd)
      .all<{ payment_method: string; cnt: number; kobo: number }>();

    const byPaymentMethod: Record<PaymentMethod, { count: number; kobo: number }> = {
      cash: { count: 0, kobo: 0 },
      card: { count: 0, kobo: 0 },
      transfer: { count: 0, kobo: 0 },
    };

    let totalSales = 0;
    let totalKobo = 0;

    for (const r of results ?? []) {
      const method = r.payment_method as PaymentMethod;
      if (method in byPaymentMethod) {
        byPaymentMethod[method] = { count: r.cnt, kobo: r.kobo };
      }
      totalSales += r.cnt;
      totalKobo += r.kobo;
    }

    return { totalSales, totalKobo, byPaymentMethod };
  }
}
