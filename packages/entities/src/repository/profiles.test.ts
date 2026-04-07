/**
 * Tests for the profiles repository — claim state transitions.
 */

import { describe, it, expect, vi } from 'vitest';
import { EntityType, ClaimLifecycleState } from '@webwaka/types';
import type { ProfileId, PlaceId } from '@webwaka/types';
import { seedProfile, advanceClaimState, getProfileBySubject, InvalidClaimTransitionError } from './profiles.js';

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------

interface D1Stmt {
  bind(...args: unknown[]): D1Stmt;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

function makeMockDb() {
  const store: Record<string, unknown>[] = [];

  return {
    _store: store,
    prepare: (sql: string): D1Stmt => {
      let boundArgs: unknown[] = [];
      const stmt: D1Stmt = {
        bind: (...args: unknown[]) => { boundArgs = args; return stmt; },
        run: vi.fn(() => {
          if (sql.startsWith('INSERT INTO profiles')) {
            const [id, subjectType, subjectId, primaryPlaceId, claimState] = boundArgs;
            store.push({ id, subject_type: subjectType, subject_id: subjectId, primary_place_id: primaryPlaceId, claim_state: claimState, verified_by: null, tenant_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          }
          if (sql.startsWith('UPDATE profiles')) {
            const [nextState, verifiedBy, id] = boundArgs;
            const row = store.find((r) => r['id'] === id);
            if (row) { row['claim_state'] = nextState; row['verified_by'] = verifiedBy; }
          }
          return Promise.resolve({});
        }),
        first: <T>(): Promise<T | null> => {
          if (sql.includes('subject_type = ?')) {
            const [subjectType, subjectId] = boundArgs;
            return Promise.resolve((store.find((r) => r['subject_type'] === subjectType && r['subject_id'] === subjectId) ?? null) as T | null);
          }
          const [id] = boundArgs;
          return Promise.resolve((store.find((r) => r['id'] === id) ?? null) as T | null);
        },
        all: <T>(): Promise<{ results: T[] }> => Promise.resolve({ results: store as unknown as T[] }),
      };
      return stmt;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedProfile', () => {
  it('creates a profile with seeded state', async () => {
    const db = makeMockDb();
    const profile = await seedProfile(db, EntityType.Individual, 'ind_001');

    expect(profile.id).toMatch(/^prf_/);
    expect((profile as unknown as Record<string, unknown>)['claimState']).toBe(ClaimLifecycleState.Seeded);
  });

  it('accepts an optional primaryPlaceId', async () => {
    const db = makeMockDb();
    const profile = await seedProfile(db, EntityType.Organization, 'org_001', 'plc_001' as unknown as PlaceId);
    expect((profile as unknown as Record<string, unknown>)['primaryPlaceId']).toBe('plc_001');
  });
});

describe('advanceClaimState', () => {
  it('transitions seeded → claimable successfully', async () => {
    const db = makeMockDb();
    const profile = await seedProfile(db, EntityType.Individual, 'ind_002');
    const advanced = await advanceClaimState(db, profile.id, ClaimLifecycleState.Claimable);
    expect((advanced as unknown as Record<string, unknown>)?.['claimState']).toBe(ClaimLifecycleState.Claimable);
  });

  it('throws InvalidClaimTransitionError on invalid transition', async () => {
    const db = makeMockDb();
    const profile = await seedProfile(db, EntityType.Individual, 'ind_003');
    await expect(
      advanceClaimState(db, profile.id, ClaimLifecycleState.Managed),
    ).rejects.toThrow(InvalidClaimTransitionError);
    await expect(
      advanceClaimState(db, profile.id, ClaimLifecycleState.Managed),
    ).rejects.toThrow(/seeded.*managed/i);
  });

  it('returns null when profile not found', async () => {
    const db = makeMockDb();
    const result = await advanceClaimState(db, 'prf_ghost' as ProfileId, ClaimLifecycleState.Claimable);
    expect(result).toBeNull();
  });
});

describe('getProfileBySubject', () => {
  it('looks up a profile by subject entity', async () => {
    const db = makeMockDb();
    await seedProfile(db, EntityType.Organization, 'org_lookup_001');
    const found = await getProfileBySubject(db, EntityType.Organization, 'org_lookup_001');
    expect(found).not.toBeNull();
  });

  it('returns null when no profile exists', async () => {
    const db = makeMockDb();
    const result = await getProfileBySubject(db, EntityType.Individual, 'ind_nonexistent');
    expect(result).toBeNull();
  });
});

describe('claim state transition validation', () => {
  it('allows claim_pending to go back to claimable (rejection flow)', async () => {
    const db = makeMockDb();
    const profile = await seedProfile(db, EntityType.Individual, 'ind_004');
    await advanceClaimState(db, profile.id, ClaimLifecycleState.Claimable);
    await advanceClaimState(db, profile.id, ClaimLifecycleState.ClaimPending);
    const result = await advanceClaimState(db, profile.id, ClaimLifecycleState.Claimable);
    expect((result as unknown as Record<string, unknown>)?.['claimState']).toBe(ClaimLifecycleState.Claimable);
  });
});
