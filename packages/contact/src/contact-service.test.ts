/**
 * ContactService + routeOTPByPurpose tests (M7f)
 * Covers: P12 (consent), P13 (primary phone), R8 (OTP routing), D1 persistence
 * Minimum: 10 tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  upsertContactChannels,
  getContactChannels,
  markChannelVerified,
  assertChannelConsent,
  assertPrimaryPhoneVerified,
  removeContactChannel,
  ContactError,
} from './contact-service.js';
import { routeOTPByPurpose, OTPRoutingError } from './channel-resolver.js';
import type { ContactChannelRecord } from './types.js';

// ---------------------------------------------------------------------------
// Mock D1Like builder
// ---------------------------------------------------------------------------

type D1MockRow = Record<string, unknown> | null;

function makeDB(firstResult: D1MockRow = null, allResults: D1MockRow[] = []) {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: (..._args: unknown[]) => ({
        run: vi.fn().mockResolvedValue({ success: true }),
        first: <T>() => Promise.resolve(firstResult as T),
        all: <T>() => Promise.resolve({ results: allResults as T[] }),
      }),
      first: <T>() => Promise.resolve(firstResult as T),
      all: <T>() => Promise.resolve({ results: allResults as T[] }),
    }),
  };
}

function makeChannel(
  overrides: Partial<ContactChannelRecord> & Pick<ContactChannelRecord, 'channel_type' | 'value'>,
): ContactChannelRecord {
  return {
    id: 'ch-' + overrides.channel_type,
    user_id: 'user-1',
    is_primary: overrides.channel_type === 'sms',
    verified: true,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// upsertContactChannels
// ---------------------------------------------------------------------------

describe('upsertContactChannels', () => {
  it('inserts new channel when not existing', async () => {
    const db = makeDB(null);
    await expect(
      upsertContactChannels(db, 'user-1', [{ channel_type: 'sms', value: '+2348011111111', is_primary: true }], 'tenant-1'),
    ).resolves.toBeUndefined();
    expect(db.prepare).toHaveBeenCalled();
  });

  it('updates existing channel when value changes', async () => {
    const db = makeDB({ id: 'ch-sms', value: '+2348000000000', verified: 1 });
    await expect(
      upsertContactChannels(db, 'user-1', [{ channel_type: 'sms', value: '+2348011111111', is_primary: true }], 'tenant-1'),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getContactChannels
// ---------------------------------------------------------------------------

describe('getContactChannels', () => {
  it('returns all channels for a user', async () => {
    const db = makeDB(null, [
      makeChannel({ channel_type: 'sms', value: '+2348011111111' }) as unknown as D1MockRow,
      makeChannel({ channel_type: 'whatsapp', value: '+2348011111111' }) as unknown as D1MockRow,
    ]);
    const result = await getContactChannels(db, 'user-1', 'tenant-1');
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// markChannelVerified
// ---------------------------------------------------------------------------

describe('markChannelVerified', () => {
  it('runs without error', async () => {
    const db = makeDB();
    await expect(markChannelVerified(db, 'user-1', 'sms', 'tenant-1')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// assertChannelConsent — P12
// ---------------------------------------------------------------------------

describe('assertChannelConsent — P12', () => {
  it('does not throw when consent record exists', async () => {
    const db = makeDB({ id: 'consent-1' });
    await expect(assertChannelConsent(db, 'user-1', 'sms', 'tenant-1')).resolves.toBeUndefined();
  });

  it('throws ContactError CONSENT_REQUIRED when no consent record', async () => {
    const db = makeDB(null);
    await expect(assertChannelConsent(db, 'user-1', 'sms', 'tenant-1')).rejects.toThrow(ContactError);
    await expect(assertChannelConsent(db, 'user-1', 'sms', 'tenant-1')).rejects.toMatchObject({
      code: 'CONSENT_REQUIRED',
    });
  });

  it('maps channel telegram → data_type telegram', async () => {
    const db = makeDB(null);
    await expect(assertChannelConsent(db, 'user-1', 'telegram', 'tenant-1')).rejects.toMatchObject({
      code: 'CONSENT_REQUIRED',
      message: expect.stringContaining('telegram'),
    });
  });
});

// ---------------------------------------------------------------------------
// assertPrimaryPhoneVerified — P13
// ---------------------------------------------------------------------------

describe('assertPrimaryPhoneVerified — P13', () => {
  it('does not throw when primary verified phone exists', async () => {
    const db = makeDB({ id: 'ch-sms' });
    await expect(assertPrimaryPhoneVerified(db, 'user-1', 'tenant-1')).resolves.toBeUndefined();
  });

  it('throws ContactError PRIMARY_PHONE_REQUIRED when no verified primary phone', async () => {
    const db = makeDB(null);
    await expect(assertPrimaryPhoneVerified(db, 'user-1', 'tenant-1')).rejects.toThrow(ContactError);
    await expect(assertPrimaryPhoneVerified(db, 'user-1', 'tenant-1')).rejects.toMatchObject({
      code: 'PRIMARY_PHONE_REQUIRED',
    });
  });
});

// ---------------------------------------------------------------------------
// routeOTPByPurpose — R8 enforcement
// ---------------------------------------------------------------------------

describe('routeOTPByPurpose — R8', () => {
  const smsChannel = makeChannel({ channel_type: 'sms', value: '+2348011111111' });
  const waChannel = makeChannel({ channel_type: 'whatsapp', value: '+2348011111111', is_primary: false });
  const tgChannel = makeChannel({ channel_type: 'telegram', value: '@user1', is_primary: false });

  it('transaction purpose — returns SMS first', () => {
    const result = routeOTPByPurpose([smsChannel, waChannel, tgChannel], 'transaction', 'sms');
    expect(result[0]?.channel).toBe('sms');
  });

  it('transaction purpose with telegram preference — still returns SMS (R8)', () => {
    const result = routeOTPByPurpose([smsChannel, tgChannel], 'transaction', 'telegram');
    expect(result[0]?.channel).toBe('sms');
    expect(result.find((r) => r.channel === 'telegram')).toBeUndefined();
  });

  it('kyc_uplift with telegram preference — SMS only, no Telegram (R8)', () => {
    const result = routeOTPByPurpose([smsChannel, waChannel, tgChannel], 'kyc_uplift', 'telegram');
    expect(result.find((r) => r.channel === 'telegram')).toBeUndefined();
    expect(result[0]?.channel).toBe('sms');
  });

  it('verification purpose with telegram preference — Telegram allowed', () => {
    const result = routeOTPByPurpose([smsChannel, waChannel, tgChannel], 'verification', 'telegram');
    expect(result[0]?.channel).toBe('telegram');
  });

  it('empty channels throws OTPRoutingError NO_ELIGIBLE_CHANNEL', () => {
    expect(() => routeOTPByPurpose([], 'transaction', 'sms')).toThrow(OTPRoutingError);
    expect(() => routeOTPByPurpose([], 'transaction', 'sms')).toThrowError(
      expect.objectContaining({ code: 'NO_ELIGIBLE_CHANNEL' }),
    );
  });
});
