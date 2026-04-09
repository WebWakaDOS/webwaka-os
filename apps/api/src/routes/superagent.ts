/**
 * SuperAgent API routes — SA-2.x / M8a-3
 *
 * POST   /superagent/consent          — Grant AI processing consent (NDPR P10)
 * DELETE /superagent/consent          — Revoke AI processing consent
 * GET    /superagent/consent          — Get current consent status + history
 * POST   /superagent/chat             — Invoke AI capability (gated by aiConsentGate)
 * GET    /superagent/usage            — Fetch usage history for current user
 *
 * All routes require authMiddleware (wired in index.ts).
 * /chat additionally runs aiConsentGate (SA-2.2).
 *
 * Platform Invariants:
 *   P7  — no direct SDK calls; resolveAdapter from @webwaka/ai (stub exec in SA-3.x)
 *   P10 — NDPR consent required before /chat (aiConsentGate)
 *   P12 — no AI on USSD (aiConsentGate)
 *   P13 — callers must not send raw PII in messages (documented obligation)
 *   T3  — tenant_id scoping on all D1 queries
 *   P9  — WakaCU amounts are integers only
 *
 * Milestone: M8a + SA-2.x
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  grantAiConsent,
  revokeAiConsent,
  getAiConsentStatus,
  listAiConsents,
  aiConsentGate,
  UsageMeter,
} from '@webwaka/superagent';
import { resolveAdapter } from '@webwaka/ai';
import { buildAIRoutingContext, AIAuthError } from '@webwaka/auth';
import type { AiConsentPurpose, AiConsentLocale } from '@webwaka/superagent';
import type { AICapabilityType } from '@webwaka/ai';
import type { Env } from '../env.js';

// ---------------------------------------------------------------------------
// D1Like (minimal — avoids direct CF Workers type import in route files)
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ success: boolean }>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const superagentRoutes = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// POST /superagent/consent — Grant AI processing consent
// ---------------------------------------------------------------------------

superagentRoutes.post('/consent', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const db = c.env.DB as unknown as D1Like;

  let body: {
    purpose?: AiConsentPurpose;
    consent_text_hash?: string;
    locale?: AiConsentLocale;
    ip_hash?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const purpose: AiConsentPurpose = body.purpose ?? 'ai_processing';
  const locale: AiConsentLocale = body.locale ?? 'en';

  if (!body.consent_text_hash) {
    return c.json(
      {
        error: 'consent_text_hash required',
        message: 'SHA-256 of the exact consent text displayed to the user must be provided.',
      },
      400,
    );
  }
  if (!body.ip_hash) {
    return c.json(
      {
        error: 'ip_hash required',
        message: 'SHA-256(PII_SALT + raw_ip) must be provided (P13).',
      },
      400,
    );
  }

  const { consentId } = await grantAiConsent(
    db as Parameters<typeof grantAiConsent>[0],
    {
      userId: auth.userId,
      tenantId: auth.tenantId,
      purpose,
      consentTextHash: body.consent_text_hash,
      locale,
      ipHash: body.ip_hash,
    },
  );

  return c.json({ consent_id: consentId, purpose, granted: true }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /superagent/consent — Revoke AI processing consent
// ---------------------------------------------------------------------------

superagentRoutes.delete('/consent', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const db = c.env.DB as unknown as D1Like;

  const purpose = (c.req.query('purpose') ?? 'ai_processing') as AiConsentPurpose;

  const { revoked } = await revokeAiConsent(
    db as Parameters<typeof revokeAiConsent>[0],
    auth.userId,
    auth.tenantId,
    purpose,
  );

  return c.json({ revoked, purpose });
});

// ---------------------------------------------------------------------------
// GET /superagent/consent — Consent status + optional history
// ---------------------------------------------------------------------------

superagentRoutes.get('/consent', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const db = c.env.DB as unknown as D1Like;

  const purpose = (c.req.query('purpose') ?? 'ai_processing') as AiConsentPurpose;
  const includeHistory = c.req.query('history') === '1';

  const status = await getAiConsentStatus(
    db as Parameters<typeof getAiConsentStatus>[0],
    auth.userId,
    auth.tenantId,
    purpose,
  );

  const history = includeHistory
    ? await listAiConsents(
        db as Parameters<typeof listAiConsents>[0],
        auth.userId,
        auth.tenantId,
      )
    : undefined;

  return c.json({
    purpose,
    granted: status.granted,
    consent_id: status.consentId,
    granted_at: status.grantedAt,
    ...(history !== undefined ? { history } : {}),
  });
});

// ---------------------------------------------------------------------------
// POST /superagent/chat — Invoke AI capability
// aiConsentGate checks P10/P12/AI-rights before reaching this handler.
// ---------------------------------------------------------------------------

superagentRoutes.post(
  '/chat',
  aiConsentGate as MiddlewareHandler<{ Bindings: Env }>,
  async (c) => {
    const auth = c.get('auth') as unknown as import('@webwaka/types').AuthContext;
    const consentId = (c.get as (k: string) => unknown)('aiConsentId') as string | null;

    let body: {
      capability?: string;
      pillar?: 1 | 2 | 3;
      messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      vertical?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!body.capability) {
      return c.json({ error: 'capability is required' }, 400);
    }
    if (!body.messages || body.messages.length === 0) {
      return c.json({ error: 'messages array is required and must not be empty' }, 400);
    }

    const capability = body.capability as AICapabilityType;
    const pillar: 1 | 2 | 3 = body.pillar ?? 1;

    // Build routing context (P10/P12 gates already passed via aiConsentGate)
    // aiRights resolved from entitlements in SA-3.x; default false (gate already passed)
    const routingCtx = buildAIRoutingContext({
      auth,
      capability,
      pillar,
      isUssd: false, // already blocked by aiConsentGate
      ndprConsentGranted: true, // already verified by aiConsentGate
      aiRights: true, // already verified by aiConsentGate
      currentSpendWakaCu: 0, // TODO SA-3.x: load from WalletService
      spendCapWakaCu: 0,
    });

    // Build env vars map for resolver (P7 — no direct SDK calls)
    const envRecord = Object.fromEntries(
      Object.entries(c.env as unknown as Record<string, unknown>).filter(
        ([, v]) => typeof v === 'string',
      ),
    ) as Record<string, string>;

    // Resolve adapter
    let resolved;
    try {
      resolved = await resolveAdapter(routingCtx, envRecord);
    } catch (err: unknown) {
      if (err instanceof AIAuthError) {
        return c.json({ error: err.code, message: err.message }, 403);
      }
      const message = err instanceof Error ? err.message : 'Adapter resolution failed';
      return c.json({ error: 'AI_ROUTING_FAILED', message }, 503);
    }

    // Record usage (actual token counts are 0 — execution wired in SA-3.x)
    const meter = new UsageMeter({ db: c.env.DB });
    await meter.record({
      tenantId: auth.tenantId,
      userId: auth.userId,
      pillar,
      capability,
      provider: resolved.config.provider,
      model: resolved.config.model,
      inputTokens: 0,
      outputTokens: 0,
      wakaCuCharged: 0,
      routingLevel: resolved.level,
      durationMs: 0,
      finishReason: 'stub',
      ndprConsentRef: consentId ?? null,
    });

    return c.json({
      provider: resolved.config.provider,
      model: resolved.config.model,
      routing_level: resolved.level,
      waku_cu_per_1k_tokens: resolved.wakaCuPer1kTokens,
      response: {
        role: 'assistant',
        content:
          '[SuperAgent chat ready — provider adapter execution wired in SA-3.x]',
      },
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cost_waku_cu: 0,
      },
    });
  },
);

// ---------------------------------------------------------------------------
// GET /superagent/usage — Usage history for current user
// ---------------------------------------------------------------------------

superagentRoutes.get('/usage', async (c) => {
  const auth = c.get('auth') as { userId: string; tenantId: string };
  const db = c.env.DB as unknown as D1Like;

  const limitStr = c.req.query('limit') ?? '50';
  const limit = Math.min(parseInt(limitStr, 10) || 50, 200);
  const pillarStr = c.req.query('pillar');

  const bindings: unknown[] = [auth.userId, auth.tenantId];
  let pillarClause = '';
  if (pillarStr) {
    pillarClause = ' AND pillar = ?';
    bindings.push(parseInt(pillarStr, 10));
  }
  bindings.push(limit);

  const { results } = await db
    .prepare(
      `SELECT id, pillar, capability, provider, model,
              input_tokens, output_tokens, wc_charged AS cost_waku_cu,
              routing_level, finish_reason, created_at
         FROM ai_usage_events
        WHERE user_id = ? AND tenant_id = ?${pillarClause}
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .bind(...bindings)
    .all<{
      id: string;
      pillar: number;
      capability: string;
      provider: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      cost_waku_cu: number;
      routing_level: number;
      finish_reason: string;
      created_at: string;
    }>();

  return c.json({ usage: results, count: results.length });
});
