/**
 * packages/verticals-pos-business — InventoryRepository tests
 * M8b acceptance criteria: ≥15 tests for product CRUD + stock management + T3 isolation.
 */

import { describe, it, expect } from 'vitest';
import { InventoryRepository } from './inventory.js';

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

function buildInventoryDb() {
  const store: Map<string, unknown> = new Map();

  const prepare = (sql: string) => ({
    bind: (...bindings: unknown[]) => ({
      run: async () => {
        if (sql.includes('INSERT INTO pos_products')) {
          const id = bindings[0] as string;
          store.set(id, {
            id,
            workspace_id: bindings[1],
            tenant_id: bindings[2],
            name: bindings[3],
            sku: bindings[4] ?? null,
            price_kobo: bindings[5],
            stock_qty: bindings[6] ?? 0,
            category: bindings[7] ?? null,
            active: 1,
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          });
        }
        if (sql.includes('UPDATE pos_products') && sql.includes('stock_qty = MAX')) {
          const delta = bindings[0] as number;
          const id = bindings[1] as string;
          const existing = store.get(id) as Record<string, unknown> | undefined;
          if (existing) {
            const current = (existing['stock_qty'] as number) ?? 0;
            store.set(id, { ...existing, stock_qty: Math.max(0, current + delta) });
          }
        }
        if (sql.includes('UPDATE pos_products') && sql.includes('active = 0')) {
          const id = bindings[0] as string;
          const existing = store.get(id) as Record<string, unknown> | undefined;
          if (existing) store.set(id, { ...existing, active: 0 });
        }
        if (sql.includes('UPDATE pos_products') && !sql.includes('stock_qty') && !sql.includes('active = 0')) {
          const id = bindings[bindings.length - 2] as string;
          const existing = store.get(id) as Record<string, unknown> | undefined;
          if (existing) {
            const updated = { ...existing, ...parseSetClauses(sql, bindings) };
            store.set(id, updated);
          }
        }
        return { success: true };
      },
      first: async <T>() => {
        const id = bindings[0] as string;
        const tenantId = bindings[1] as string;
        const row = store.get(id) as Record<string, unknown> | undefined;
        if (!row || row['tenant_id'] !== tenantId) return null as T;
        return row as T;
      },
      all: async <T>() => {
        const results = Array.from(store.values()).filter((r) => {
          const row = r as Record<string, unknown>;
          const matchWs = row['workspace_id'] === bindings[0];
          const matchTenant = row['tenant_id'] === bindings[1];
          return matchWs && matchTenant;
        }) as T[];
        return { results };
      },
    }),
  });

  return { prepare };
}

function parseSetClauses(sql: string, bindings: unknown[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const match = sql.match(/SET (.+?) WHERE/s);
  if (!match) return result;

  const clauses = (match[1] ?? '').split(',').map((c) => c.trim());
  let idx = 0;
  for (const clause of clauses) {
    const col = clause.split('=')[0]?.trim();
    if (col && col !== 'updated_at') {
      result[col] = bindings[idx++];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InventoryRepository — Create', () => {
  it('creates a product with given attributes', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    const product = await repo.create({
      id: 'prod_001',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      name: 'Garri (1kg)',
      priceKobo: 100000,
      stockQty: 50,
    });

    expect(product.id).toBe('prod_001');
    expect(product.name).toBe('Garri (1kg)');
    expect(product.priceKobo).toBe(100000);
    expect(product.stockQty).toBe(50);
    expect(product.active).toBe(true);
  });

  it('throws on float priceKobo (P9)', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    await expect(
      repo.create({
        id: 'prod_002',
        workspaceId: 'wsp_001',
        tenantId: 'tenant_a',
        name: 'Bad Product',
        priceKobo: 100.5,
      }),
    ).rejects.toThrow('P9');
  });

  it('creates product with sku and category', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    const product = await repo.create({
      id: 'prod_003',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      name: 'Rice (5kg)',
      priceKobo: 350000,
      sku: 'RICE-5KG',
      category: 'Food',
    });

    expect(product.sku).toBe('RICE-5KG');
    expect(product.category).toBe('Food');
  });

  it('defaults stockQty to 0 when not provided', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    const product = await repo.create({
      id: 'prod_004',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      name: 'Sugar',
      priceKobo: 80000,
    });

    expect(product.stockQty).toBe(0);
  });
});

describe('InventoryRepository — T3 Isolation', () => {
  it('findById returns null for wrong tenant (T3)', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    await repo.create({
      id: 'prod_t01',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_b',
      name: 'Oil',
      priceKobo: 120000,
    });

    const result = await repo.findById('prod_t01', 'tenant_a');
    expect(result).toBeNull();
  });

  it('findByWorkspace only returns rows for correct tenant', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    await repo.create({ id: 'prod_w01', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'A', priceKobo: 1000 });
    await repo.create({ id: 'prod_w02', workspaceId: 'wsp_001', tenantId: 'tenant_b', name: 'B', priceKobo: 2000 });

    const results = await repo.findByWorkspace('wsp_001', 'tenant_a');
    expect(results.every((r) => r.tenantId === 'tenant_a')).toBe(true);
  });
});

describe('InventoryRepository — Stock Management', () => {
  it('adjustStock adds stock (positive delta)', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    await repo.create({ id: 'prod_s01', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'Flour', priceKobo: 60000, stockQty: 10 });

    const updated = await repo.adjustStock('prod_s01', 'tenant_a', { delta: 20, reason: 'restock' });
    expect(updated?.stockQty).toBe(30);
  });

  it('adjustStock deducts stock (negative delta)', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    await repo.create({ id: 'prod_s02', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'Butter', priceKobo: 50000, stockQty: 15 });

    const updated = await repo.adjustStock('prod_s02', 'tenant_a', { delta: -5, reason: 'sold' });
    expect(updated?.stockQty).toBe(10);
  });

  it('adjustStock floors at 0 (no negative stock)', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    await repo.create({ id: 'prod_s03', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'Yam', priceKobo: 25000, stockQty: 3 });

    const updated = await repo.adjustStock('prod_s03', 'tenant_a', { delta: -100, reason: 'write-off' });
    expect(updated?.stockQty).toBe(0);
  });

  it('throws on float delta (P9)', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    await expect(
      repo.adjustStock('prod_s04', 'tenant_a', { delta: 1.5, reason: 'bad' }),
    ).rejects.toThrow('P9');
  });
});

describe('InventoryRepository — Deactivate', () => {
  it('deactivates a product (soft delete)', async () => {
    const db = buildInventoryDb();
    const repo = new InventoryRepository(db as unknown as D1Database);

    await repo.create({ id: 'prod_d01', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'Old Product', priceKobo: 1000 });

    const result = await repo.deactivate('prod_d01', 'tenant_a');
    expect(result).toBe(true);
  });
});
