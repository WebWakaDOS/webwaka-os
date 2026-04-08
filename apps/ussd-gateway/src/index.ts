/**
 * apps/ussd-gateway — USSD Gateway Worker (M7b + M7c)
 * Framework: Hono (T1 — Cloudflare-first)
 *
 * Shortcode: *384# (pending NCC registration)
 * Carrier: Africa's Talking USSD webhook
 *
 * Feature map:
 *   *384# → 1  — My Wallet (balance)
 *   *384# → 2  — Send Money (KYC gated T1-T3)
 *   *384# → 3  — Trending Now (top 5 social posts by like_count, M7c)
 *   *384# → 4  — Book Transport
 *   *384# → 5  — Community (user's joined communities, M7c)
 *
 * Session state: USSD_SESSION_KV (3-minute TTL, TDR-0010)
 * Rate limit: RATE_LIMIT_KV (R5 — 30/hr per phone)
 *
 * M7c additions (T3 enforced — tenant_id on all D1 queries):
 *   Branch 3: Pre-fetches top 5 social_posts sorted by like_count before processing
 *   Branch 5: Pre-fetches community_memberships → community_spaces for user's phone
 */

import { Hono } from 'hono';
import { getOrCreateSession, saveSession, deleteSession, type USSDSession } from './session.js';
import { processUSSDInput } from './processor.js';
import { mainMenu, type TrendingPostSnippet, type CommunityItem } from './menus.js';
import { handleTelegramWebhook, type TelegramUpdate } from './telegram.js';

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
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  /**
   * T3: USSD Worker tenant identity. Set via `wrangler secret put TENANT_ID` per deployment.
   * Each deployed USSD Worker instance serves exactly one tenant.
   * In multi-tenant Cloudflare deployments, Workers are dispatched per-subdomain so
   * TENANT_ID is always a trusted secret from the Worker runtime, never a user input.
   */
  TENANT_ID?: string;
}

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// D1 data pre-fetchers (M7c — Branch 3 and 5)
// ---------------------------------------------------------------------------

/**
 * Fetch top 5 trending social posts sorted by like_count (Branch 3).
 * Gracefully returns empty array on D1 error.
 */
async function fetchTrendingPosts(db: D1Database, tenantId: string): Promise<TrendingPostSnippet[]> {
  try {
    const result = await db
      .prepare(
        `SELECT p.id, p.content, sp.handle
         FROM social_posts p
         JOIN social_profiles sp ON sp.id = p.author_id AND sp.tenant_id = p.tenant_id
         WHERE p.tenant_id = ? AND p.is_deleted = 0 AND p.post_type = 'post'
         ORDER BY p.like_count DESC
         LIMIT 5`,
      )
      .bind(tenantId)
      .all<{ id: string; content: string; handle: string }>();
    return (result.results ?? []).map((r) => ({ id: r.id, snippet: r.content, authorHandle: r.handle }));
  } catch {
    return [];
  }
}

/**
 * Fetch communities the user is a member of (Branch 5).
 * Looks up user by phone number via social_profiles. Gracefully returns empty.
 */
async function fetchUserCommunities(
  db: D1Database,
  phone: string,
  tenantId: string,
): Promise<CommunityItem[]> {
  try {
    // Resolve phone → user_id via social_profiles.phone_number if available,
    // otherwise fall back to identity lookup stub (phone lookup returns empty safely).
    const profileRow = await db
      .prepare(
        `SELECT p.id FROM social_profiles p
         WHERE p.phone_number = ? AND p.tenant_id = ? LIMIT 1`,
      )
      .bind(phone, tenantId)
      .first<{ id: string }>();

    if (!profileRow) return [];

    const userId = profileRow.id;
    const result = await db
      .prepare(
        `SELECT cs.id, cs.name
         FROM community_memberships cm
         JOIN community_spaces cs ON cs.id = cm.community_id AND cs.tenant_id = cm.tenant_id
         WHERE cm.user_id = ? AND cm.tenant_id = ? AND cm.status = 'active'
         ORDER BY cm.joined_at DESC
         LIMIT 5`,
      )
      .bind(userId, tenantId)
      .all<{ id: string; name: string }>();
    return (result.results ?? []).map((r) => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}

/**
 * Determine if the user is navigating to Branch 3 (trending) or Branch 5 (community)
 * based on the current session state and raw text input.
 */
function lastSegment(text: string): string {
  if (!text) return '';
  const parts = text.split('*');
  return parts[parts.length - 1] ?? '';
}

// ---------------------------------------------------------------------------
// POST /ussd — Africa's Talking USSD webhook
// Body: application/x-www-form-urlencoded
//   sessionId, serviceCode, phoneNumber, text
// ---------------------------------------------------------------------------

app.post('/ussd', async (c) => {
  const body = await c.req.parseBody();
  const sessionId = String(body['sessionId'] ?? '');
  const phoneNumber = String(body['phoneNumber'] ?? '');
  const text = String(body['text'] ?? '');

  if (!sessionId || !phoneNumber) {
    return c.text('END Invalid USSD request.', 400);
  }

  // T3: Derive tenantId from Worker env (set via wrangler secret put TENANT_ID per deployment).
  // Each USSD Worker instance is deployed per-tenant subdomain; TENANT_ID is never user-supplied.
  const tenantId = c.env.TENANT_ID ?? 'default';

  try {
    let session = await getOrCreateSession(c.env.USSD_SESSION_KV, sessionId, phoneNumber);

    // Fresh session — show main menu immediately
    if (!text) {
      const result = processUSSDInput(session, '');
      await saveSession(c.env.USSD_SESSION_KV, result.session);
      return c.text(result.ended ? result.text : mainMenu(), 200, { 'Content-Type': 'text/plain' });
    }

    // M7c — Pre-fetch D1 data when user is navigating to Branch 3 or 5
    const input = lastSegment(text);
    if (session.state === 'main_menu') {
      if (input === '3') {
        // Branch 3: fetch trending posts, inject into session before processing
        const trendingPosts = await fetchTrendingPosts(c.env.DB, tenantId);
        session = { ...session, data: { ...session.data, trendingPosts } };
      } else if (input === '5') {
        // Branch 5: fetch user's communities, inject into session before processing
        const communities = await fetchUserCommunities(c.env.DB, phoneNumber, tenantId);
        session = { ...session, data: { ...session.data, communities } };
      }
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

// ---------------------------------------------------------------------------
// M7f: Telegram Bot webhook — POST /telegram/webhook
// ---------------------------------------------------------------------------

/**
 * POST /telegram/webhook
 * Receives Telegram Bot updates. Validates TELEGRAM_WEBHOOK_SECRET header.
 * Always returns 200 — Telegram requires 200 even on processing errors.
 *
 * On /start command: looks up user by Telegram handle, updates telegram_chat_id.
 */
app.post('/telegram/webhook', async (c) => {
  const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (!secretToken || secretToken !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json<TelegramUpdate>().catch(() => null);

  if (body) {
    await handleTelegramWebhook(body, {
      DB: c.env.DB as unknown as Parameters<typeof handleTelegramWebhook>[1]['DB'],
      TELEGRAM_BOT_TOKEN: c.env.TELEGRAM_BOT_TOKEN,
    }).catch((err) => {
      console.error('[telegram/webhook] Error handling update:', err instanceof Error ? err.message : err);
    });
  }

  return c.json({ ok: true });
});

/**
 * GET /health — liveness probe
 */
app.get('/health', (c) => c.json({ status: 'ok', service: 'ussd-gateway' }));

export default app;
