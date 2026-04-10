/**
 * @webwaka/negotiation — Price-Lock Token
 *
 * Generates a URL-safe base64-encoded token that locks a negotiated price
 * for checkout. The token carries the session ID, final price in integer kobo,
 * tenant ID, and issue timestamp.
 *
 * P9: final_price_kobo is always an INTEGER. Assertion is made at generation time.
 *
 * SECURITY NOTE: This token is NOT cryptographically signed in MVP.
 * TODO: sign with HMAC-SHA256 using a platform secret key before production.
 * For MVP, the session_id is used as a cross-check at verification time.
 *
 * Token validity: 24 hours from issued_at.
 */

import type { NegotiationSession, PriceLockPayload } from './types.js';
import { InvalidPriceLockError } from './types.js';

const TOKEN_VALIDITY_SECONDS = 24 * 3600;

export function generatePriceLockToken(session: NegotiationSession): string {
  if (session.final_price_kobo === null) {
    throw new Error('Cannot generate price lock token for a non-accepted session');
  }
  if (!Number.isInteger(session.final_price_kobo) || session.final_price_kobo <= 0) {
    throw new Error('final_price_kobo must be a positive integer');
  }

  const payload: PriceLockPayload = {
    session_id: session.id,
    final_price_kobo: session.final_price_kobo,
    tenant_id: session.tenant_id,
    issued_at: Math.floor(Date.now() / 1000),
  };

  const json = JSON.stringify(payload);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function verifyPriceLockToken(
  token: string,
  tenantId: string,
): { session_id: string; final_price_kobo: number } {
  let payload: PriceLockPayload;

  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const json = atob(padded + '='.repeat(padLen));
    payload = JSON.parse(json) as PriceLockPayload;
  } catch {
    throw new InvalidPriceLockError('malformed token');
  }

  if (
    typeof payload.session_id !== 'string' ||
    typeof payload.final_price_kobo !== 'number' ||
    typeof payload.tenant_id !== 'string' ||
    typeof payload.issued_at !== 'number'
  ) {
    throw new InvalidPriceLockError('missing required fields');
  }

  if (payload.tenant_id !== tenantId) {
    throw new InvalidPriceLockError('tenant mismatch');
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - payload.issued_at > TOKEN_VALIDITY_SECONDS) {
    throw new InvalidPriceLockError('token expired');
  }

  if (!Number.isInteger(payload.final_price_kobo) || payload.final_price_kobo <= 0) {
    throw new InvalidPriceLockError('invalid price');
  }

  return {
    session_id: payload.session_id,
    final_price_kobo: payload.final_price_kobo,
  };
}
