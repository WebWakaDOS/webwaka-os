/**
 * apps/ussd-gateway
 *
 * USSD Gateway Worker — Africa's Talking integration
 * Shortcode: *384# (pending NCC registration)
 *
 * Feature map (see docs/enhancements/m7/offline-sync.md):
 *   *384# → 1  — Check wallet / balance
 *   *384# → 2  — Send money (KYC gated T1-T3)
 *   *384# → 3  — Trending feed (top 5 posts by engagement)
 *   *384# → 4  — Book transport seat
 *   *384# → 5  — Community announcements
 *
 * Session state: Cloudflare KV (USSD_SESSION_KV) — 3-minute TTL
 * Rate limiting: RATE_LIMIT_KV (R5 — 30 USSD requests per phone per hour)
 */

// TODO M7b — Implement:
// - apps/ussd-gateway/src/session-manager.ts (KV-backed session state)
// - apps/ussd-gateway/src/menus/ (one file per menu: main, wallet, feed, transport, community)
// - apps/ussd-gateway/src/handlers/ (one handler per USSD feature)
// - apps/ussd-gateway/src/rate-limiter.ts
// - apps/ussd-gateway/src/auth.ts (phone number → tenant_id resolution)

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response('USSD Gateway — Stub (M7b)', { status: 200 });
  },
};

interface Env {
  DB: D1Database;
  RATE_LIMIT_KV: KVNamespace;
  USSD_SESSION_KV: KVNamespace;
  AFRICAS_TALKING_USERNAME: string;
  AFRICAS_TALKING_API_KEY: string;
  INTER_SERVICE_SECRET: string;
  JWT_SECRET: string;
  LOG_PII_SALT: string;
  ENVIRONMENT: 'staging' | 'production';
}
