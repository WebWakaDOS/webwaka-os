/**
 * packages/verticals-pos-business — CustomerRepository tests
 * M8b acceptance criteria: ≥10 tests for CRM + loyalty + T3 isolation.
 */

import { describe, it, expect } from 'vitest';
import { CustomerRepository } from './customers.js';

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

function buildCustomerDb() {
  const store: Map<string, unknown> = new Map();

  const prepare = (sql: string) => ({
    bind: (...bindings: unknown[]) => ({
      run: async () => {
        if (sql.includes('INSERT INTO pos_customers')) {
          const id = bindings[0] as string;
          store.set(id, {
            id,
            workspace_id: bindings[1],
            tenant_id: bindings[2],
            phone: bindings[3] ?? null,
            name: bindings[4] ?? null,
            loyalty_pts: 0,
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
          });
        }
        if (sql.includes('loyalty_pts = loyalty_pts +')) {
          const pts = bindings[0] as number;
          const id = bindings[1] as string;
          const existing = store.get(id) as Record<string, unknown> | undefined;
          if (existing) {
            store.set(id, { ...existing, loyalty_pts: ((existing['loyalty_pts'] as number) ?? 0) + pts });
          }
        }
        if (sql.includes('loyalty_pts = loyalty_pts -')) {
          const pts = bindings[0] as number;
          const id = bindings[1] as string;
          const existing = store.get(id) as Record<string, unknown> | undefined;
          if (existing) {
            store.set(id, { ...existing, loyalty_pts: ((existing['loyalty_pts'] as number) ?? 0) - pts });
          }
        }
        if (sql.includes('UPDATE pos_customers') && !sql.includes('loyalty_pts')) {
          const id = bindings[bindings.length - 2] as string;
          const existing = store.get(id) as Record<string, unknown> | undefined;
          if (existing) {
            store.set(id, { ...existing });
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
        const wsId = bindings[0] as string;
        const tenantId = bindings[1] as string;
        const results = Array.from(store.values()).filter((r) => {
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

describe('CustomerRepository — Create', () => {
  it('creates a customer with phone and name', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    const customer = await repo.create({
      id: 'cust_001',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      phone: '08012345678',
      name: 'Amaka Obi',
    });

    expect(customer.id).toBe('cust_001');
    expect(customer.phone).toBe('08012345678');
    expect(customer.name).toBe('Amaka Obi');
    expect(customer.loyaltyPts).toBe(0);
  });

  it('creates a customer without phone or name', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    const customer = await repo.create({
      id: 'cust_002',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
    });

    expect(customer.phone).toBeNull();
    expect(customer.name).toBeNull();
  });

  it('starts with 0 loyalty points', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    const customer = await repo.create({
      id: 'cust_003',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      phone: '08099999999',
    });

    expect(customer.loyaltyPts).toBe(0);
  });
});

describe('CustomerRepository — T3 Isolation', () => {
  it('findById returns null for wrong tenant (T3)', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    await repo.create({
      id: 'cust_t01',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_b',
      phone: '08011111111',
    });

    const result = await repo.findById('cust_t01', 'tenant_a');
    expect(result).toBeNull();
  });

  it('listByWorkspace excludes other tenants (T3)', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    await repo.create({ id: 'cust_w01', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'A' });
    await repo.create({ id: 'cust_w02', workspaceId: 'wsp_001', tenantId: 'tenant_b', name: 'B' });

    const results = await repo.listByWorkspace('wsp_001', 'tenant_a');
    expect(results.length).toBe(1);
    expect(results[0]?.name).toBe('A');
  });
});

describe('CustomerRepository — Loyalty Points', () => {
  it('awards loyalty points (P9 — integer only)', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    await repo.create({ id: 'cust_l01', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'Bola' });
    const updated = await repo.awardPoints('cust_l01', 'tenant_a', 10);
    expect(updated?.loyaltyPts).toBe(10);
  });

  it('throws on float loyalty points (P9)', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    await expect(
      repo.awardPoints('cust_l02', 'tenant_a', 1.5),
    ).rejects.toThrow('P9');
  });

  it('throws on zero points to award (P9)', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    await expect(
      repo.awardPoints('cust_l03', 'tenant_a', 0),
    ).rejects.toThrow('P9');
  });

  it('redeems loyalty points when balance sufficient', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    await repo.create({ id: 'cust_r01', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'Chidi' });
    await repo.awardPoints('cust_r01', 'tenant_a', 20);
    const { success, customer } = await repo.redeemPoints('cust_r01', 'tenant_a', 10);
    expect(success).toBe(true);
    expect(customer?.loyaltyPts).toBe(10);
  });

  it('fails to redeem when balance insufficient', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    await repo.create({ id: 'cust_r02', workspaceId: 'wsp_001', tenantId: 'tenant_a', name: 'Emeka' });
    const { success } = await repo.redeemPoints('cust_r02', 'tenant_a', 100);
    expect(success).toBe(false);
  });

  it('throws on float points to redeem (P9)', async () => {
    const db = buildCustomerDb();
    const repo = new CustomerRepository(db as unknown as D1Database);

    await expect(
      repo.redeemPoints('cust_r03', 'tenant_a', 1.5),
    ).rejects.toThrow('P9');
  });
});
