/**
 * Auth middleware scaffold for Hono (Cloudflare Workers).
 * (TDR-0008, security-baseline.md)
 *
 * This file defines the middleware contract. The actual Hono integration
 * is wired in apps/api once the Hono package is installed.
 *
 * Design:
 * - Validates JWT
 * - Extracts AuthContext
 * - Attaches to request context
 * - Rejects requests without valid tenant context (hard 401)
 */

import { verifyJwt, extractAuthContext, extractBearerToken, JwtValidationError } from './jwt.js';
import type { AuthContext } from '@webwaka/types';

// ---------------------------------------------------------------------------
// Middleware result types
// ---------------------------------------------------------------------------

export type AuthMiddlewareSuccess = {
  readonly success: true;
  readonly context: AuthContext;
};

export type AuthMiddlewareFailure = {
  readonly success: false;
  readonly status: 401 | 403;
  readonly message: string;
};

export type AuthMiddlewareResult = AuthMiddlewareSuccess | AuthMiddlewareFailure;

// ---------------------------------------------------------------------------
// Core auth resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the auth context from a raw Authorization header and JWT secret.
 *
 * This function is framework-agnostic. Wire it into Hono middleware in apps/api.
 *
 * @param authorizationHeader - The raw value of the Authorization header
 * @param jwtSecret - JWT_SECRET from Cloudflare Worker secrets
 */
export async function resolveAuthContext(
  authorizationHeader: string | null,
  jwtSecret: string,
): Promise<AuthMiddlewareResult> {
  const token = extractBearerToken(authorizationHeader);

  if (!token) {
    return {
      success: false,
      status: 401,
      message: 'Missing Authorization header. Expected: "Bearer <token>"',
    };
  }

  try {
    const payload = await verifyJwt(token, jwtSecret);
    const context = extractAuthContext(payload);
    return { success: true, context };
  } catch (err) {
    if (err instanceof JwtValidationError) {
      return {
        success: false,
        status: 401,
        message: err.message,
      };
    }
    return {
      success: false,
      status: 401,
      message: 'Authentication failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Internal service authentication
// ---------------------------------------------------------------------------

/**
 * Validates an inter-service secret for internal API calls.
 * (security-baseline.md — INTER_SERVICE_SECRET)
 *
 * Internal service routes bypass user JWT but require this header.
 */
export function validateInternalServiceSecret(
  headerValue: string | null,
  expectedSecret: string,
): boolean {
  if (!headerValue) return false;
  // Constant-time comparison to prevent timing attacks
  if (headerValue.length !== expectedSecret.length) return false;
  let diff = 0;
  for (let i = 0; i < headerValue.length; i++) {
    diff |= headerValue.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  return diff === 0;
}
