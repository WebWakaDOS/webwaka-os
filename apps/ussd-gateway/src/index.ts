/**
 * apps/ussd-gateway — USSD Gateway Worker (M7b)
 * Framework: Hono (T1 — Cloudflare-first)
 *
 * Shortcode: *384# (pending NCC registration)
 * Carrier: Africa's Talking USSD webhook
 *
 * Feature map:
 *   *384# → 1  — My Wallet (balance)
 *   *384# → 2  — Send Money (KYC gated T1-T3)
 *   *384# → 3  — Trending Now (top engagement)
 *   *384# → 4  — Book Transport
 *   *384# → 5  — Community
 *
 * Session state: USSD_SESSION_KV (3-minute TTL, TDR-0010)
 * Rate limit: RATE_LIMIT_KV (R5 — 30/hr per phone)
 */

import { Hono } from 'hono';
import { getOrCreateSession, saveSession, deleteSession } from './session.js';
import { processUSSDInput } from './processor.js';
import { mainMenu } from './menus.js';

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

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /ussd — Africa's Talking USSD webhook
 * Body: application/x-www-form-urlencoded
 *   sessionId, serviceCode, phoneNumber, text
 */
app.post('/ussd', async (c) => {
  const body = await c.req.parseBody();
  const sessionId = String(body['sessionId'] ?? '');
  const phoneNumber = String(body['phoneNumber'] ?? '');
  const text = String(body['text'] ?? '');

  if (!sessionId || !phoneNumber) {
    return c.text('END Invalid USSD request.', 400);
  }

  try {
    const session = await getOrCreateSession(c.env.USSD_SESSION_KV, sessionId, phoneNumber);

    // Fresh session — show main menu immediately without processing input
    if (!text) {
      const result = processUSSDInput(session, '');
      await saveSession(c.env.USSD_SESSION_KV, result.session);
      return c.text(result.ended ? result.text : mainMenu(), 200, { 'Content-Type': 'text/plain' });
    }

    const result = processUSSDInput(session, text);

    if (result.ended) {
      await deleteSession(c.env.USSD_SESSION_KV, sessionId);
    } else {
      await saveSession(c.env.USSD_SESSION_KV, result.session);
    }

    return c.text(result.text, 200, { 'Content-Type': 'text/plain' });
  } catch (err) {
    console.error('[ussd-gateway] Error processing USSD request:', err);
    return c.text('END Service unavailable. Please try again later.', 200, { 'Content-Type': 'text/plain' });
  }
});

/**
 * GET /health — liveness probe
 */
app.get('/health', (c) => c.json({ status: 'ok', service: 'ussd-gateway' }));

export default app;
