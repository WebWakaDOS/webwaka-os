import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializePayment, verifyPayment, verifyWebhookSignature, PaystackError } from './paystack.js';
import type { ProviderConfig, PaymentIntent } from './types.js';

const CONFIG: ProviderConfig = {
  secretKey: 'sk_test_fake_key',
  baseUrl: 'https://api.paystack.co',
};

const INTENT: PaymentIntent = {
  workspaceId: 'wsp_abc123',
  amountKobo: 5000_00,
  email: 'test@example.com',
  callbackUrl: 'https://example.com/callback',
};

describe('initializePayment', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns initialized payment on success', async () => {
    const mockResponse = {
      status: true,
      message: 'Authorization URL created',
      data: {
        authorization_url: 'https://checkout.paystack.com/abc',
        access_code: 'ac_abc123',
        reference: 'ref_xyz789',
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await initializePayment(CONFIG, INTENT);

    expect(result.reference).toBe('ref_xyz789');
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/abc');
    expect(result.accessCode).toBe('ac_abc123');
    expect(result.amountKobo).toBe(500000);
  });

  it('throws PaystackError on non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ status: false, message: 'Invalid key' }),
    } as Response);

    await expect(initializePayment(CONFIG, INTENT)).rejects.toThrow(PaystackError);
  });

  it('throws PaystackError when status is false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: false, message: 'Duplicate reference' }),
    } as Response);

    await expect(initializePayment(CONFIG, INTENT)).rejects.toThrow(PaystackError);
  });

  it('sends correct Authorization header', async () => {
    const mockResponse = {
      status: true,
      message: 'OK',
      data: {
        authorization_url: 'https://checkout.paystack.com/x',
        access_code: 'ac_x',
        reference: 'ref_x',
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    await initializePayment(CONFIG, INTENT);

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/transaction/initialize'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${CONFIG.secretKey}`,
        }),
      }),
    );
  });
});

describe('verifyPayment', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns verified payment on success status', async () => {
    const mockResponse = {
      status: true,
      message: 'Verification successful',
      data: {
        reference: 'ref_xyz789',
        status: 'success',
        amount: 500000,
        currency: 'NGN',
        paid_at: '2026-01-01T12:00:00.000Z',
        metadata: {},
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await verifyPayment(CONFIG, 'ref_xyz789');

    expect(result.status).toBe('success');
    expect(result.amountKobo).toBe(500000);
    expect(result.reference).toBe('ref_xyz789');
  });

  it('maps failed transaction to failed status', async () => {
    const mockResponse = {
      status: true,
      message: 'Verification successful',
      data: {
        reference: 'ref_fail',
        status: 'failed',
        amount: 100,
        currency: 'NGN',
        paid_at: null,
        metadata: {},
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await verifyPayment(CONFIG, 'ref_fail');
    expect(result.status).toBe('failed');
  });

  it('maps unknown status to abandoned', async () => {
    const mockResponse = {
      status: true,
      message: 'Verification successful',
      data: {
        reference: 'ref_ab',
        status: 'abandoned',
        amount: 100,
        currency: 'NGN',
        paid_at: null,
        metadata: {},
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await verifyPayment(CONFIG, 'ref_ab');
    expect(result.status).toBe('abandoned');
  });

  it('throws PaystackError on HTTP error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ status: false, message: 'Transaction reference not found' }),
    } as Response);

    await expect(verifyPayment(CONFIG, 'bad_ref')).rejects.toThrow(PaystackError);
  });
});

describe('PaystackError', () => {
  it('has name PaystackError', () => {
    const err = new PaystackError('oops');
    expect(err.name).toBe('PaystackError');
    expect(err.message).toBe('oops');
    expect(err instanceof Error).toBe(true);
  });
});

describe('verifyWebhookSignature', () => {
  it('returns false on garbage signature', async () => {
    const result = await verifyWebhookSignature('{"event":"test"}', 'notsig', 'secret');
    expect(result).toBe(false);
  });
});
