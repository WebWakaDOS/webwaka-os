/**
 * packages/verticals-pos-business — SalesRepository tests
 * M8b acceptance criteria: ≥10 tests for sale recording + T3 isolation + P9.
 */

import { describe, it, expect } from 'vitest';
import { SalesRepository } from './sales.js';

// ---------------------------------------------------------------------------
// In-memory D1 mock for pos_sales + pos_products (for stock decrement)
// ---------------------------------------------------------------------------

function buildSalesDb() {
  const salesStore: Map<string, unknown> = new Map();
  const productStore: Map<string, unknown> = new Map([
    ['prod_001', { id: 'prod_001', workspace_id: 'wsp_001', tenant_id: 'tenant_a', stock_qty: 20 }],
    ['prod_002', { id: 'prod_002', workspace_id: 'wsp_001', tenant_id: 'tenant_a', stock_qty: 5 }],
  ]);

  const prepare = (sql: string) => ({
    bind: (...bindings: unknown[]) => ({
      run: async () => {
        if (sql.includes('INSERT INTO pos_sales')) {
          const id = bindings[0] as string;
          salesStore.set(id, {
            id,
            workspace_id: bindings[1],
            tenant_id: bindings[2],
            cashier_id: bindings[3],
            total_kobo: bindings[4],
            payment_method: bindings[5],
            items_json: bindings[6],
            created_at: Math.floor(Date.now() / 1000),
          });
        }
        if (sql.includes('UPDATE pos_products')) {
          const qty = Math.abs(bindings[0] as number);
          const id = bindings[1] as string;
          const existing = productStore.get(id) as Record<string, unknown> | undefined;
          if (existing) {
            const current = (existing['stock_qty'] as number) ?? 0;
            productStore.set(id, { ...existing, stock_qty: Math.max(0, current - qty) });
          }
        }
        return { success: true };
      },
      first: async <T>() => {
        const id = bindings[0] as string;
        const tenantId = bindings[1] as string;
        const row = salesStore.get(id) as Record<string, unknown> | undefined;
        if (!row || row['tenant_id'] !== tenantId) return null as T;
        return row as T;
      },
      all: async <T>() => {
        const wsId = bindings[0] as string;
        const tenantId = bindings[1] as string;
        const results = Array.from(salesStore.values()).filter((r) => {
          const row = r as Record<string, unknown>;
          return row['workspace_id'] === wsId && row['tenant_id'] === tenantId;
        }) as T[];
        return { results };
      },
    }),
  });

  return { prepare };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SalesRepository — Record Sale', () => {
  it('records a valid cash sale', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    const sale = await repo.recordSale({
      id: 'sale_001',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      cashierId: 'usr_cashier',
      paymentMethod: 'cash',
      items: [
        { productId: 'prod_001', qty: 2, priceKobo: 100000 },
      ],
    });

    expect(sale.id).toBe('sale_001');
    expect(sale.totalKobo).toBe(200000);
    expect(sale.paymentMethod).toBe('cash');
  });

  it('calculates total correctly for multiple items (P9)', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    const sale = await repo.recordSale({
      id: 'sale_002',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      cashierId: 'usr_cashier',
      paymentMethod: 'card',
      items: [
        { productId: 'prod_001', qty: 1, priceKobo: 100000 },
        { productId: 'prod_002', qty: 3, priceKobo: 50000 },
      ],
    });

    expect(sale.totalKobo).toBe(250000);
  });

  it('throws on empty items array', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    await expect(
      repo.recordSale({
        id: 'sale_003',
        workspaceId: 'wsp_001',
        tenantId: 'tenant_a',
        cashierId: 'usr_cashier',
        paymentMethod: 'cash',
        items: [],
      }),
    ).rejects.toThrow();
  });

  it('throws on float priceKobo (P9)', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    await expect(
      repo.recordSale({
        id: 'sale_004',
        workspaceId: 'wsp_001',
        tenantId: 'tenant_a',
        cashierId: 'usr_cashier',
        paymentMethod: 'transfer',
        items: [{ productId: 'prod_001', qty: 1, priceKobo: 99.99 }],
      }),
    ).rejects.toThrow('P9');
  });

  it('throws on zero qty (P9)', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    await expect(
      repo.recordSale({
        id: 'sale_005',
        workspaceId: 'wsp_001',
        tenantId: 'tenant_a',
        cashierId: 'usr_cashier',
        paymentMethod: 'cash',
        items: [{ productId: 'prod_001', qty: 0, priceKobo: 10000 }],
      }),
    ).rejects.toThrow();
  });

  it('stores serialized items_json', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    const items = [{ productId: 'prod_001', qty: 2, priceKobo: 100000 }];
    const sale = await repo.recordSale({
      id: 'sale_006',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      cashierId: 'usr_cashier',
      paymentMethod: 'cash',
      items,
    });

    expect(sale.items).toEqual(items);
  });
});

describe('SalesRepository — T3 Isolation', () => {
  it('findById returns null for wrong tenant (T3)', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    await repo.recordSale({
      id: 'sale_t01',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_b',
      cashierId: 'usr_cashier',
      paymentMethod: 'cash',
      items: [{ productId: 'prod_001', qty: 1, priceKobo: 5000 }],
    });

    const result = await repo.findById('sale_t01', 'tenant_a');
    expect(result).toBeNull();
  });

  it('listByWorkspace only returns rows for correct tenant (T3)', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    await repo.recordSale({ id: 'sale_w01', workspaceId: 'wsp_001', tenantId: 'tenant_a', cashierId: 'usr_1', paymentMethod: 'cash', items: [{ productId: 'prod_001', qty: 1, priceKobo: 1000 }] });
    await repo.recordSale({ id: 'sale_w02', workspaceId: 'wsp_001', tenantId: 'tenant_b', cashierId: 'usr_2', paymentMethod: 'cash', items: [{ productId: 'prod_001', qty: 1, priceKobo: 1000 }] });

    const results = await repo.listByWorkspace('wsp_001', 'tenant_a');
    expect(results.length).toBe(1);
    expect(results[0]?.tenantId).toBe('tenant_a');
  });
});

describe('SalesRepository — Payment Methods', () => {
  it('records card payment', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    const sale = await repo.recordSale({
      id: 'sale_pm01',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      cashierId: 'usr_cashier',
      paymentMethod: 'card',
      items: [{ productId: 'prod_001', qty: 1, priceKobo: 5000 }],
    });

    expect(sale.paymentMethod).toBe('card');
  });

  it('records transfer payment', async () => {
    const db = buildSalesDb();
    const repo = new SalesRepository(db as unknown as D1Database);

    const sale = await repo.recordSale({
      id: 'sale_pm02',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      cashierId: 'usr_cashier',
      paymentMethod: 'transfer',
      items: [{ productId: 'prod_001', qty: 1, priceKobo: 5000 }],
    });

    expect(sale.paymentMethod).toBe('transfer');
  });
});
