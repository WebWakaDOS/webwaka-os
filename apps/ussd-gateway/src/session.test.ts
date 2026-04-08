/**
 * Tests for USSD session management (KV-backed, 3-minute TTL).
 */

import { describe, it, expect, vi } from 'vitest';
import { getOrCreateSession, saveSession, deleteSession } from './session.js';
import type { USSDSession } from './session.js';

function makeMockKV(initial?: USSDSession): {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn().mockResolvedValue(initial ?? null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('getOrCreateSession', () => {
  it('returns existing session from KV when found', async () => {
    const existing: USSDSession = {
      sessionId: 'sess_001',
      phone: '+2348012345678',
      state: 'wallet_menu',
      data: { recipient: '+2348099999999' },
      createdAt: Date.now() - 30_000,
    };
    const kv = makeMockKV(existing);
    const session = await getOrCreateSession(kv, 'sess_001', '+2348012345678');
    expect(session.state).toBe('wallet_menu');
    expect(session.sessionId).toBe('sess_001');
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('creates a new session at main_menu when none exists', async () => {
    const kv = makeMockKV();
    const session = await getOrCreateSession(kv, 'sess_new', '+2348012345678');
    expect(session.state).toBe('main_menu');
    expect(session.phone).toBe('+2348012345678');
    expect(session.data).toEqual({});
    expect(kv.put).toHaveBeenCalledOnce();
  });

  it('stores new session with 180s TTL', async () => {
    const kv = makeMockKV();
    await getOrCreateSession(kv, 'sess_ttl', '+2348099999999');
    expect(kv.put).toHaveBeenCalledWith(
      'ussd:sess_ttl',
      expect.any(String),
      { expirationTtl: 180 },
    );
  });

  it('uses ussd:{sessionId} as KV key', async () => {
    const kv = makeMockKV();
    await getOrCreateSession(kv, 'abc123', '+2348000000000');
    expect(kv.get).toHaveBeenCalledWith('ussd:abc123', 'json');
  });
});

describe('saveSession', () => {
  it('serializes session to JSON and stores with 180s TTL', async () => {
    const kv = makeMockKV();
    const session: USSDSession = {
      sessionId: 'sess_save',
      phone: '+2348012345678',
      state: 'send_money_enter_amount',
      data: { recipient: '+2348099999999' },
      createdAt: Date.now(),
    };
    await saveSession(kv, session);
    expect(kv.put).toHaveBeenCalledWith(
      'ussd:sess_save',
      JSON.stringify(session),
      { expirationTtl: 180 },
    );
  });
});

describe('deleteSession', () => {
  it('deletes session from KV by sessionId', async () => {
    const kv = makeMockKV();
    await deleteSession(kv, 'sess_del');
    expect(kv.delete).toHaveBeenCalledWith('ussd:sess_del');
  });
});
