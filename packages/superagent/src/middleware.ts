/**
 * SuperAgent Consent Middleware — SA-2.2
 * WebWaka OS — Hono middleware for AI-gated routes.
 *
 * Usage:
 *   app.use('/superagent/*', aiConsentGate);
 *   // OR per-route:
 *   superagentRoutes.post('/chat', aiConsentGate, async (c) => { ... })
 *
 * Guards enforced (in order):
 *   1. P12 — No AI on USSD sessions (assertNotUssd)
 *   2. AI rights check — plan must include AI features
 *   3. P10 — NDPR AI consent required (getAiConsentStatus + assertNdprConsent)
 *
 * On consent missing → 403 JSON body with consent_url.
 * On USSD → 403 JSON body explaining channel limitation.
 * On no AI rights → 403 JSON body with upgrade_url.
 */

import { assertNdprConsent, assertNotUssd, AIAuthError } from '@webwaka/auth';
import { getAiConsentStatus } from './consent-service.js';

// Minimal env shape needed by the middleware
interface AiGateEnv {
  DB: D1Database;
}

// Minimal auth shape read from the Hono context store
interface AuthShape {
  userId: string;
  tenantId: string;
  aiRights?: boolean;
}

// Hono middleware function type (avoids importing full Context generic chain)
type HonoMiddlewareArgs = [
  c: {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
    req: { header(name: string): string | undefined };
    env: AiGateEnv;
    json(data: unknown, status?: number): Response;
  },
  next: () => Promise<void>,
];

/**
 * Hono middleware that gates any AI-powered route.
 *
 * Expects `auth` to be set in the context store by the auth middleware.
 * Attaches `aiConsentId` to the context on success so downstream routes
 * can reference the consent record in ai_usage_events.
 */
export async function aiConsentGate(
  ...[c, next]: HonoMiddlewareArgs
): Promise<Response | void> {
  try {
    const auth = c.get('auth') as AuthShape | undefined;

    if (!auth) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // P12 — USSD guard (header set by USSD Gateway Worker, verified via INTER_SERVICE_SECRET)
    const channel = c.req.header('x-waka-channel');
    assertNotUssd(channel);

    // Plan AI rights check (from JWT claim — no DB hit needed)
    if (auth.aiRights === false) {
      return c.json(
        {
          error: 'AI_RIGHTS_DENIED',
          message:
            'Your current plan does not include AI features. ' +
            'Upgrade to Growth or Enterprise to unlock SuperAgent.',
          upgrade_url: '/workspaces/upgrade',
        },
        403,
      );
    }

    // P10 — NDPR AI consent check (D1 lookup against superagent_consents)
    const status = await getAiConsentStatus(
      c.env.DB as unknown as Parameters<typeof getAiConsentStatus>[0],
      auth.userId,
      auth.tenantId,
    );
    assertNdprConsent(status.granted);

    // Attach consent ID so the usage-meter can reference it (P10 audit)
    c.set('aiConsentId', status.consentId);

    await next();
  } catch (err) {
    if (err instanceof AIAuthError) {
      return c.json(
        {
          error: err.code,
          message: err.message,
          ...(err.code === 'NDPR_CONSENT_REQUIRED'
            ? { consent_url: '/superagent/consent' }
            : {}),
        },
        403,
      );
    }
    throw err;
  }
}
