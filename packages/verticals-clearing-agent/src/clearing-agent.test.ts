/**
 * packages/verticals-clearing-agent — ClearingAgentRepository tests
 * M9 Transport Extended — acceptance: ≥15 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClearingAgentRepository } from './clearing-agent.js';
import {
  guardSeedToClaimed,
  guardClaimedToNcsVerified,
  isValidClearingAgentTransition,
} from './types.js';

function makeDb() {
  const store: Record<string, unknown>[] = [];
  const prep = (sql: string) => {
    const bindFn = (...vals: unknown[]) => ({
      run: async () => {
        const s = sql.trim().toUpperCase();
        if (s.startsWith('INSERT')) {
          const colM = sql.match(/\(([^)]+)\)\s+VALUES/i);
          const valM = sql.match(/VALUES\s*\(([^)]+)\)/i);
          if (colM && valM) {
            const cols = colM[1]!.split(',').map((c: string) => c.trim());
            const tokens = valM[1]!.split(',').map((v: string) => v.trim());
            const row: Record<string, unknown> = {};
            let bi = 0;
            cols.forEach((col: string, i: number) => {
              const tok = tokens[i] ?? '?';
              if (tok === '?') { row[col] = vals[bi++]; }
              else if (tok.toUpperCase() === 'NULL') { row[col] = null; }
              else if (tok.toLowerCase().includes('unixepoch')) { row[col] = Math.floor(Date.now() / 1000); }
              else if (tok.startsWith("'") && tok.endsWith("'")) { row[col] = tok.slice(1, -1); }
              else if (!Number.isNaN(Number(tok))) { row[col] = Number(tok); }
              else { row[col] = vals[bi++]; }
            });
            if (!row['status']) row['status'] = 'seeded';
            if (!row['created_at']) row['created_at'] = Math.floor(Date.now() / 1000);
            if (!row['updated_at']) row['updated_at'] = Math.floor(Date.now() / 1000);
            store.push(row);
          }
        } else if (s.startsWith('UPDATE')) {
          const setM = sql.match(/SET\s+(.+?)\s+WHERE/is);
          if (setM) {
            const clauses = setM[1]!.split(',').map((c: string) => c.trim()).filter((c: string) => !c.toLowerCase().includes('updated_at') && !c.toLowerCase().includes('unixepoch'));
            const id = vals[vals.length - 2] as string;
            const tid = vals[vals.length - 1] as string;
            const idx = store.findIndex(r => r['id'] === id && r['tenant_id'] === tid);
            if (idx >= 0) {
              clauses.forEach((clause: string, i: number) => {
                const col = clause.split('=')[0]!.trim();
                (store[idx] as Record<string, unknown>)[col] = vals[i];
              });
              (store[idx] as Record<string, unknown>)['updated_at'] = Math.floor(Date.now() / 1000);
            }
          }
        }
        return { success: true };
      },
      first: async <T>() => {
        if (!sql.trim().toUpperCase().startsWith('SELECT')) return null as T;
        const found = store.find(r =>
          vals.length >= 2 ? (r['id'] === vals[0] || r['workspace_id'] === vals[0]) && r['tenant_id'] === vals[1] : r['id'] === vals[0]
        );
        return (found ?? null) as T;
      },
      all: async <T>() => ({
        results: store.filter(r =>
          vals.length >= 2
            ? (r['profile_id'] === vals[0] || r['workspace_id'] === vals[0]) && r['tenant_id'] === vals[1]
            : true
        ),
      } as { results: T[] }),
    });
    return { bind: bindFn };
  };
  return { prepare: prep } as unknown as ConstructorParameters<typeof ClearingAgentRepository>[0];
}

describe('ClearingAgentRepository', () => {
  let repo: ClearingAgentRepository;
  beforeEach(() => { repo = new ClearingAgentRepository(makeDb() as never); });

  it('creates a profile with seeded status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws1', tenantId: 't1', companyName: 'Apex Clearing Ltd' });
    expect(p.status).toBe('seeded');
    expect(p.companyName).toBe('Apex Clearing Ltd');
    expect(p.tenantId).toBe('t1');
  });

  it('creates profile with ncs licence', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws2', tenantId: 't1', companyName: 'Lagos Clearing', ncsLicence: 'NCS-001', nagaffNumber: 'NAG-999' });
    expect(p.ncsLicence).toBe('NCS-001');
    expect(p.nagaffNumber).toBe('NAG-999');
  });

  it('finds profile by ID scoped to tenant', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws3', tenantId: 't2', companyName: 'Nimble Freight' });
    const found = await repo.findProfileById(p.id, 't2');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(p.id);
  });

  it('finds profile by workspace', async () => {
    await repo.createProfile({ workspaceId: 'ws4', tenantId: 't3', companyName: 'Swift Clearing' });
    const found = await repo.findProfileByWorkspace('ws4', 't3');
    expect(found).not.toBeNull();
    expect(found!.workspaceId).toBe('ws4');
  });

  it('returns null for unknown profile ID', async () => {
    const result = await repo.findProfileById('nonexistent', 't1');
    expect(result).toBeNull();
  });

  it('updates profile company name', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws5', tenantId: 't1', companyName: 'Old Name' });
    const updated = await repo.updateProfile(p.id, 't1', { companyName: 'New Name' });
    expect(updated!.companyName).toBe('New Name');
  });

  it('transitions status via transitionStatus', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws6', tenantId: 't1', companyName: 'Trans Ltd' });
    const t = await repo.transitionStatus(p.id, 't1', 'claimed');
    expect(t!.status).toBe('claimed');
  });

  it('creates a shipment with valid kobo values', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws7', tenantId: 't1', companyName: 'Cargo Co' });
    const s = await repo.createShipment({ profileId: p.id, tenantId: 't1', declaredValueKobo: 5000000, dutyAmountKobo: 1000000, professionalFeeKobo: 250000 });
    expect(s.declaredValueKobo).toBe(5000000);
    expect(s.status).toBe('lodgement');
  });

  it('creates shipment with port and form M', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws8', tenantId: 't1', companyName: 'Port Cargo' });
    const s = await repo.createShipment({ profileId: p.id, tenantId: 't1', declaredValueKobo: 1000000, dutyAmountKobo: 200000, professionalFeeKobo: 50000, port: 'tin_can', formMNumber: 'MF20241001' });
    expect(s.port).toBe('tin_can');
    expect(s.formMNumber).toBe('MF20241001');
  });

  it('rejects shipment with float declaredValueKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws9', tenantId: 't1', companyName: 'Float Co' });
    await expect(repo.createShipment({ profileId: p.id, tenantId: 't1', declaredValueKobo: 100.5, dutyAmountKobo: 10, professionalFeeKobo: 5 })).rejects.toThrow('P9');
  });

  it('rejects shipment with negative dutyAmountKobo (P9)', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws10', tenantId: 't1', companyName: 'Neg Co' });
    await expect(repo.createShipment({ profileId: p.id, tenantId: 't1', declaredValueKobo: 100, dutyAmountKobo: -1, professionalFeeKobo: 5 })).rejects.toThrow('P9');
  });

  it('lists shipments for profile scoped to tenant', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws11', tenantId: 't1', companyName: 'Multi Ship' });
    await repo.createShipment({ profileId: p.id, tenantId: 't1', declaredValueKobo: 1000, dutyAmountKobo: 100, professionalFeeKobo: 50 });
    await repo.createShipment({ profileId: p.id, tenantId: 't1', declaredValueKobo: 2000, dutyAmountKobo: 200, professionalFeeKobo: 100 });
    const list = await repo.listShipments(p.id, 't1');
    expect(list.length).toBe(2);
  });

  it('updates shipment status', async () => {
    const p = await repo.createProfile({ workspaceId: 'ws12', tenantId: 't1', companyName: 'Status Co' });
    const s = await repo.createShipment({ profileId: p.id, tenantId: 't1', declaredValueKobo: 1000, dutyAmountKobo: 100, professionalFeeKobo: 50 });
    const updated = await repo.updateShipmentStatus(s.id, 't1', 'examination');
    expect(updated!.status).toBe('examination');
  });

  it('FSM: valid transition seeded → claimed', () => {
    expect(isValidClearingAgentTransition('seeded', 'claimed')).toBe(true);
  });

  it('FSM: invalid transition seeded → ncs_verified', () => {
    expect(isValidClearingAgentTransition('seeded', 'ncs_verified')).toBe(false);
  });

  it('FSM: valid transition ncs_verified → active', () => {
    expect(isValidClearingAgentTransition('ncs_verified', 'active')).toBe(true);
  });

  it('guardSeedToClaimed: allows KYC Tier 1', () => {
    expect(guardSeedToClaimed({ kycTier: 1 }).allowed).toBe(true);
  });

  it('guardSeedToClaimed: blocks KYC Tier 0', () => {
    expect(guardSeedToClaimed({ kycTier: 0 }).allowed).toBe(false);
  });

  it('guardClaimedToNcsVerified: blocks if no NCS licence', () => {
    expect(guardClaimedToNcsVerified({ ncsLicence: null, nagaffNumber: 'NAG1', kycTier: 3 }).allowed).toBe(false);
  });

  it('guardClaimedToNcsVerified: blocks if KYC Tier 2', () => {
    expect(guardClaimedToNcsVerified({ ncsLicence: 'NCS1', nagaffNumber: 'NAG1', kycTier: 2 }).allowed).toBe(false);
  });

  it('guardClaimedToNcsVerified: allows with all fields at KYC Tier 3', () => {
    expect(guardClaimedToNcsVerified({ ncsLicence: 'NCS1', nagaffNumber: 'NAG1', kycTier: 3 }).allowed).toBe(true);
  });
});
