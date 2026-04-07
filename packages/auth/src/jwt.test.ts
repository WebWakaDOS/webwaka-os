/**
 * Tests for JWT validation.
 * (TDR-0008, security-baseline.md §2)
 *
 * 8 required test cases per Base44 Milestone 2 review findings.
 *
 * Uses Web Crypto API (globalThis.crypto) — available in Node 18+, Cloudflare Workers, browsers.
 */

import { describe, it, expect } from 'vitest';
import { Role } from '@webwaka/types';
import {
  verifyJwt,
  extractBearerToken,
  JwtValidationError,
  MissingTenantContextError,
} from './jwt.js';

// ---------------------------------------------------------------------------
// Test JWT builder (Web Crypto — same API used in production jwt.ts)
// ---------------------------------------------------------------------------

function b64urlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToB64url(obj: Record<string, unknown>): string {
  return b64urlEncode(JSON.stringify(obj));
}

const HEADER_B64 = jsonToB64url({ alg: 'HS256', typ: 'JWT' });

interface TestPayload {
  sub?: string;
  workspace_id?: string;
  tenant_id?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

async function buildTestJwt(payload: TestPayload, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    sub: 'user_test_001',
    workspace_id: 'ws_test_001',
    tenant_id: 'tenant_test_001',
    role: Role.Admin,
    iat: now - 10,
    exp: now + 3600,
    ...payload,
  };

  const payloadB64 = jsonToB64url(fullPayload);
  const signingInput = `${HEADER_B64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signingInput));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${signatureB64}`;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-at-least-32-characters-long!!';
const WRONG_SECRET = 'wrong-secret-at-least-32-characters-long!!';

// ---------------------------------------------------------------------------
// Test 1: Valid JWT + correct secret → full JwtPayload
// ---------------------------------------------------------------------------

describe('verifyJwt', () => {
  it('1. valid JWT + correct secret → returns full JwtPayload', async () => {
    const token = await buildTestJwt({}, TEST_SECRET);
    const payload = await verifyJwt(token, TEST_SECRET);

    expect(payload.sub).toBe('user_test_001');
    expect(payload.workspace_id).toBe('ws_test_001');
    expect(payload.tenant_id).toBe('tenant_test_001');
    expect(payload.role).toBe(Role.Admin);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  // -------------------------------------------------------------------------
  // Test 2: Valid JWT + wrong secret → JwtValidationError
  // -------------------------------------------------------------------------

  it('2. valid JWT + wrong secret → JwtValidationError', async () => {
    const token = await buildTestJwt({}, TEST_SECRET);

    await expect(verifyJwt(token, WRONG_SECRET)).rejects.toThrow(JwtValidationError);
    await expect(verifyJwt(token, WRONG_SECRET)).rejects.toThrow('signature verification failed');
  });

  // -------------------------------------------------------------------------
  // Test 3: Expired JWT → JwtValidationError ("expired")
  // -------------------------------------------------------------------------

  it('3. expired JWT → JwtValidationError with "expired" in message', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await buildTestJwt(
      { iat: now - 7200, exp: now - 3600 }, // expired 1 hour ago
      TEST_SECRET,
    );

    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow(JwtValidationError);
    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow(/expired/i);
  });

  // -------------------------------------------------------------------------
  // Test 4: Missing tenant_id → MissingTenantContextError
  // -------------------------------------------------------------------------

  it('4. missing tenant_id → MissingTenantContextError', async () => {
    const token = await buildTestJwt({ tenant_id: '' }, TEST_SECRET);

    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow(MissingTenantContextError);
    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow(JwtValidationError);
  });

  // -------------------------------------------------------------------------
  // Test 5: Missing workspace_id → JwtValidationError
  // -------------------------------------------------------------------------

  it('5. missing workspace_id → JwtValidationError (missing required claims)', async () => {
    // Build token manually without workspace_id
    const now = Math.floor(Date.now() / 1000);
    const barePayload = {
      sub: 'user_test_001',
      tenant_id: 'tenant_test_001',
      role: Role.Admin,
      iat: now - 10,
      exp: now + 3600,
      // workspace_id intentionally omitted
    };
    const payloadB64 = jsonToB64url(barePayload);
    const signingInput = `${HEADER_B64}.${payloadB64}`;

    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(TEST_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signingInput));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const token = `${signingInput}.${sigB64}`;

    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow(JwtValidationError);
    await expect(verifyJwt(token, TEST_SECRET)).rejects.toThrow(/missing required claims/i);
  });

  // -------------------------------------------------------------------------
  // Test 6: Malformed token → JwtValidationError
  // -------------------------------------------------------------------------

  it('6. malformed token (not 3 parts) → JwtValidationError', async () => {
    await expect(verifyJwt('not.a.valid.jwt.structure', TEST_SECRET))
      .rejects.toThrow(JwtValidationError);

    await expect(verifyJwt('only-one-part', TEST_SECRET))
      .rejects.toThrow(JwtValidationError);

    await expect(verifyJwt('', TEST_SECRET))
      .rejects.toThrow(JwtValidationError);
  });
});

// ---------------------------------------------------------------------------
// Test 7: extractBearerToken("Bearer abc123") → "abc123"
// ---------------------------------------------------------------------------

describe('extractBearerToken', () => {
  it('7. extractBearerToken("Bearer abc123") → "abc123"', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('7a. extractBearerToken is case-insensitive for "bearer" prefix', () => {
    expect(extractBearerToken('bearer abc123')).toBe('abc123');
    expect(extractBearerToken('BEARER abc123')).toBe('abc123');
  });

  // -------------------------------------------------------------------------
  // Test 8: extractBearerToken(null) → null
  // -------------------------------------------------------------------------

  it('8. extractBearerToken(null) → null', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('8a. extractBearerToken with malformed header → null', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull(); // no token after prefix
  });
});
