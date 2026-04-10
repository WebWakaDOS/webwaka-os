/**
 * KV-backed rate limiting middleware for WebWaka API (M7a)
 * (docs/governance/security-baseline.md R5, R9)
 *
 * Implements sliding-window rate limiting using Cloudflare KV.
 * Used for: identity verification endpoints (R5: 2/hour), OTP sends (R9: 5/hour).
 *
 * SEC-005 hardening:
 * - Retry-After header added to all 429 responses (RFC 7231 §7.1.3)
 * - Rate-limit key uses CF-Connecting-IP (not forgeable X-User-Id)
 * - All KV operations wrapped in try/catch — KV unavailability fails open
 *   to preserve availability rather than blocking all requests
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../env.js';

interface RateLimitOptions {
  keyPrefix: string;
  maxRequests: number;
  windowSeconds: number;
}

export function rateLimitMiddleware(opts: RateLimitOptions) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    // SEC-005: Use CF-Connecting-IP — this is set by Cloudflare and cannot be
    // forged by the client. X-Forwarded-For is used as a local dev fallback only.
    const subject =
      c.req.header('CF-Connecting-IP') ??
      c.req.header('X-Forwarded-For') ??
      'unknown';
    const key = `rl:${opts.keyPrefix}:${subject}`;
    const kv = c.env.RATE_LIMIT_KV;

    // SEC-005: Fail open when KV is unavailable — never block requests due to
    // infrastructure issues; the alternative (blocking all traffic) is worse.
    let count = 0;
    try {
      const raw = await kv.get(key);
      count = raw ? parseInt(raw, 10) : 0;
    } catch {
      // KV unavailable — fail open to preserve availability
      await next();
      return;
    }

    if (count >= opts.maxRequests) {
      // SEC-005: Add Retry-After header (RFC 7231 §7.1.3)
      c.header('Retry-After', String(opts.windowSeconds));
      return c.json(
        {
          error: 'rate_limit_exceeded',
          message: `Too many requests. Maximum ${opts.maxRequests} per ${opts.windowSeconds / 60} minute(s).`,
          retry_after_seconds: opts.windowSeconds,
        },
        429,
      );
    }

    // SEC-005: KV write failures must not block the request
    try {
      await kv.put(key, String(count + 1), { expirationTtl: opts.windowSeconds });
    } catch {
      // KV write failed — don't block the request
    }

    await next();
  });
}

/** Identity verification rate limit: R5 — 2 verifications per hour per user */
export const identityRateLimit = rateLimitMiddleware({
  keyPrefix: 'identity:verify',
  maxRequests: 2,
  windowSeconds: 3600,
});
