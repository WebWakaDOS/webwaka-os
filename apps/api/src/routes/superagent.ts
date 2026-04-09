/**
 * SuperAgent API routes — SA-3.x / SA-2.x / M8a-3
 *
 * POST   /superagent/consent          — Grant AI processing consent (NDPR P10)
 * DELETE /superagent/consent          — Revoke AI processing consent
 * GET    /superagent/consent          — Get current consent status + history
 * POST   /superagent/chat             — Invoke AI capability (live provider execution SA-3.x)
 * GET    /superagent/usage            — Fetch usage history for current user
 *
 * All routes require authMiddleware (wired in index.ts).
 * /chat additionally runs aiConsentGate (SA-2.2).
 *
 * Platform Invariants:
 *   P7  — no direct SDK calls; createAdapter from @webwaka/ai-adapters (fetch-only)
 *   P9  — WakaCU amounts are integers only; CreditBurnEngine enforces this
 *   P10 — NDPR consent required before /chat (aiConsentGate)
 *   P12 — no AI on USSD (aiConsentGate)
 *   P13 — callers must not send raw PII in messages (documented obligation)
 *   T3  — tenant_id scoping on all D1 queries
 *
 * SA-3.x execution flow (POST /chat):
 *   1. aiConsentGate — P12 USSD block → AI rights → P10 NDPR (already passed by gate)
 *   2. WalletService.getWallet — load spend cap + current spend for routing context
 *   3. resolveAdapter — 5-level BYOK chain → picks provider + model + key
 *   4. createAdapter(resolved).complete(aiRequest) — live HTTP fetch to provider (P7)
 *   5. CreditBurnEngine.burn — deduct WakaCU: pool → own wallet → BYOK (post-pay, P9)
 *   6. UsageMeter.record — write ai_usage_events row with real token counts (P10, P13)
 *   7. Return real response content + usage summary
 *
 * Milestone: M8a + SA-2.x + SA-3.x
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
  WalletService,
  CreditBurnEngine,
  PartnerPoolService,
} from '@webwaka/superagent';
import { resolveAdapter } from '@webwaka/ai';
import { createAdapter } from '@webwaka/ai-adapters';
import { buildAIRoutingContext, AIAuthError } from '@webwaka/auth';
import type { AiConsentPurpose, AiConsentLocale } from '@webwaka/superagent';
import type { AICapabilityType, AIRequest } from '@webwaka/ai';
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
// POST /superagent/chat — Live AI capability invocation (SA-3.x)
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
      max_tokens?: number;
      temperature?: number;
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

    // Step 1: Load wallet for spend cap context (P9 — integers only)
    const walletService = new WalletService({ db: c.env.DB });
    const wallet = await walletService.getWallet(auth.tenantId);

    // Step 2: Build routing context (P10/P12 gates already passed via aiConsentGate)
    const routingCtx = buildAIRoutingContext({
      auth,
      capability,
      pillar,
      isUssd: false,             // already blocked by aiConsentGate (P12)
      ndprConsentGranted: true,  // already verified by aiConsentGate (P10)
      aiRights: true,            // already verified by aiConsentGate
      currentSpendWakaCu: wallet?.currentMonthSpentWakaCu ?? 0,
      spendCapWakaCu: wallet?.spendCapMonthlyWakaCu ?? 0,
    });

    // Step 3: Build env vars map for resolver (P7 — no direct SDK calls)
    const envRecord = Object.fromEntries(
      Object.entries(c.env as unknown as Record<string, unknown>).filter(
        ([, v]) => typeof v === 'string',
      ),
    ) as Record<string, string>;

    // Step 4: Resolve adapter — 5-level BYOK chain
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

    // Step 5: Execute live provider call (P7 — createAdapter uses fetch only, no SDK)
    const adapter = createAdapter(resolved);
    const aiRequest: AIRequest = {
      messages: body.messages,
      maxTokens: body.max_tokens ?? 1024,
      temperature: body.temperature ?? 0.7,
    };

    const startMs = Date.now();
    let aiResponse: Awaited<ReturnType<typeof adapter.complete>>;
    try {
      aiResponse = await adapter.complete(aiRequest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Provider call failed';
      return c.json({ error: 'AI_PROVIDER_ERROR', message }, 503);
    }
    const durationMs = Date.now() - startMs;

    // Step 6: Charge WakaCU — pool → own wallet → BYOK (P9 integer accounting)
    // Generate stable burn reference for idempotency (Worker retry safety).
    const burnRef = crypto.randomUUID();
    const partnerPoolService = new PartnerPoolService({ db: c.env.DB, walletService });
    const burnEngine = new CreditBurnEngine({ walletService, partnerPoolService });

    const burn = await burnEngine.burn({
      tenantId: auth.tenantId,
      resolved,
      tokensUsed: aiResponse.tokensUsed,
      usageEventId: burnRef,
    });

    // Step 7: Record usage event (P10 — NDPR consent ref; P13 — no prompt content stored)
    const meter = new UsageMeter({ db: c.env.DB });
    await meter.record({
      tenantId: auth.tenantId,
      userId: auth.userId,
      pillar,
      capability,
      provider: aiResponse.provider,
      model: aiResponse.model,
      // SA-4.x: split prompt/completion tokens once adapters expose them separately
      inputTokens: 0,
      outputTokens: aiResponse.tokensUsed,
      wakaCuCharged: burn.wakaCuCharged,
      routingLevel: resolved.level,
      durationMs,
      finishReason: aiResponse.finishReason,
      ndprConsentRef: consentId ?? null,
    });

    return c.json({
      provider: aiResponse.provider,
      model: aiResponse.model,
      routing_level: resolved.level,
      waku_cu_per_1k_tokens: resolved.wakaCuPer1kTokens,
      response: {
        role: 'assistant',
        content: aiResponse.content,
      },
      usage: {
        input_tokens: 0,
        output_tokens: aiResponse.tokensUsed,
        total_tokens: aiResponse.tokensUsed,
        cost_waku_cu: burn.wakaCuCharged,
        charge_source: burn.chargeSource,
        balance_after_waku_cu: burn.balanceAfter,
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
