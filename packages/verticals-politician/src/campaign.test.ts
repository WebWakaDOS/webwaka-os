/**
 * packages/verticals-politician — CampaignRepository tests
 * M8b acceptance criteria: ≥15 tests for campaign donation management + T3 isolation.
 */

import { describe, it, expect } from 'vitest';
import { CampaignRepository } from './campaign.js';

// ---------------------------------------------------------------------------
// In-memory D1 mock for campaign_donations
// ---------------------------------------------------------------------------

function buildCampaignDb() {
  const store: Map<string, unknown> = new Map();

  const prepare = (sql: string) => ({
    bind: (...bindings: unknown[]) => ({
      run: async () => {
        if (sql.includes('INSERT INTO campaign_donations')) {
          const id = bindings[0] as string;
          store.set(id, {
            id,
            workspace_id: bindings[1],
            tenant_id: bindings[2],
            donor_phone: bindings[3],
            amount_kobo: bindings[4],
            paystack_ref: bindings[5] ?? null,
            status: 'pending',
            created_at: Math.floor(Date.now() / 1000),
          });
        }
        if (sql.includes("SET status = 'confirmed'")) {
          // SQL: SET status='confirmed', paystack_ref=? WHERE id=? AND tenant_id=? AND status='pending'
          // bindings: [paystackRef, id, tenantId]
          const id = bindings[1] as string;
          const existing = store.get(id);
          if (existing && typeof existing === 'object') {
            store.set(id, { ...(existing as object), status: 'confirmed', paystack_ref: bindings[0] });
          }
        }
        if (sql.includes("SET status = 'failed'")) {
          const id = bindings[0] as string;
          const existing = store.get(id);
          if (existing && typeof existing === 'object') {
            store.set(id, { ...(existing as object), status: 'failed' });
          }
        }
        return { success: true };
      },
      first: async <T>() => {
        // For SELECT queries with WHERE id = ? AND tenant_id = ?
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

describe('CampaignRepository — Donation Creation', () => {
  it('creates a donation with pending status', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    const donation = await repo.createDonation({
      id: 'don_001',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      donorPhone: '08012345678',
      amountKobo: 10000,
    });

    expect(donation.id).toBe('don_001');
    expect(donation.status).toBe('pending');
    expect(donation.amountKobo).toBe(10000);
  });

  it('throws on non-integer amountKobo (P9)', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    await expect(
      repo.createDonation({
        id: 'don_002',
        workspaceId: 'wsp_001',
        tenantId: 'tenant_a',
        donorPhone: '08012345678',
        amountKobo: 10000.5,
      }),
    ).rejects.toThrow('P9');
  });

  it('throws on zero amountKobo (P9)', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    await expect(
      repo.createDonation({
        id: 'don_003',
        workspaceId: 'wsp_001',
        tenantId: 'tenant_a',
        donorPhone: '08012345678',
        amountKobo: 0,
      }),
    ).rejects.toThrow('P9');
  });

  it('creates donation with paystackRef', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    const donation = await repo.createDonation({
      id: 'don_004',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      donorPhone: '08087654321',
      amountKobo: 50000,
      paystackRef: 'PS_REF_ABC123',
    });

    expect(donation.paystackRef).toBe('PS_REF_ABC123');
  });

  it('sets paystackRef null when not provided', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    const donation = await repo.createDonation({
      id: 'don_005',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      donorPhone: '08012345678',
      amountKobo: 5000,
    });

    expect(donation.paystackRef).toBeNull();
  });
});

describe('CampaignRepository — T3 Isolation', () => {
  it('findDonationById returns null for wrong tenant (T3)', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    await repo.createDonation({
      id: 'don_t01',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_b',
      donorPhone: '08012345678',
      amountKobo: 5000,
    });

    const result = await repo.findDonationById('don_t01', 'tenant_a');
    expect(result).toBeNull();
  });
});

describe('CampaignRepository — Donation Lifecycle', () => {
  it('confirms a pending donation', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    await repo.createDonation({
      id: 'don_c01',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      donorPhone: '08012345678',
      amountKobo: 20000,
    });

    const confirmed = await repo.confirmDonation('don_c01', 'tenant_a', 'PAYSTACK_REF_XYZ');
    expect(confirmed?.status).toBe('confirmed');
    expect(confirmed?.paystackRef).toBe('PAYSTACK_REF_XYZ');
  });

  it('fails a pending donation', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    await repo.createDonation({
      id: 'don_f01',
      workspaceId: 'wsp_001',
      tenantId: 'tenant_a',
      donorPhone: '08012345678',
      amountKobo: 15000,
    });

    const failed = await repo.failDonation('don_f01', 'tenant_a');
    expect(failed?.status).toBe('failed');
  });

  it('lists donations by workspace (T3 scoped)', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    await repo.createDonation({ id: 'don_l01', workspaceId: 'wsp_001', tenantId: 'tenant_a', donorPhone: '08000000001', amountKobo: 1000 });
    await repo.createDonation({ id: 'don_l02', workspaceId: 'wsp_001', tenantId: 'tenant_a', donorPhone: '08000000002', amountKobo: 2000 });

    const list = await repo.listDonationsByWorkspace('wsp_001', 'tenant_a');
    expect(list.length).toBe(2);
  });

  it('does not cross-contaminate donations across workspaces (T3)', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);

    await repo.createDonation({ id: 'don_x01', workspaceId: 'wsp_002', tenantId: 'tenant_a', donorPhone: '08000000001', amountKobo: 1000 });
    await repo.createDonation({ id: 'don_x02', workspaceId: 'wsp_001', tenantId: 'tenant_b', donorPhone: '08000000002', amountKobo: 2000 });

    const listA = await repo.listDonationsByWorkspace('wsp_001', 'tenant_a');
    expect(listA.length).toBe(0);
  });
});

describe('CampaignRepository — Totals', () => {
  it('totalConfirmedKobo returns 0 with no confirmed donations', async () => {
    const db = buildCampaignDb();
    const repo = new CampaignRepository(db as unknown as D1Database);
    const total = await repo.totalConfirmedKobo('wsp_001', 'tenant_a');
    expect(total).toBe(0);
  });
});
